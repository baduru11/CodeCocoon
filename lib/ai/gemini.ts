import { GoogleGenAI, Type } from "@google/genai";
import type { AIProvider, GenerateOptions, GenerateResult, StreamChunk } from "./provider";
import { GEMINI_MODELS } from "@/lib/constants";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 10000;
const BASE_DELAY_503_MS = 20000; // Longer backoff for server overload

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    // Rate limit / server overload
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) return true;
    if (msg.includes("503") || msg.includes("UNAVAILABLE")) return true;
    // Network errors (socket closed, timeout, DNS, etc.)
    if (msg.includes("fetch failed") || msg.includes("socket") || msg.includes("ECONNRESET")) return true;
    if (msg.includes("other side closed") || msg.includes("network")) return true;
    // Check nested cause
    const cause = (error as { cause?: Error }).cause;
    if (cause instanceof Error) {
      const causeMsg = cause.message;
      if (causeMsg.includes("closed") || causeMsg.includes("socket") || causeMsg.includes("ECONNRESET")) return true;
    }
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 429 || status === 503) return true;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "UND_ERR_SOCKET" || code === "ECONNRESET" || code === "ETIMEDOUT") return true;
  }
  return false;
}

function is503(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("high demand")) return true;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    return (error as { status: number }).status === 503;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Global serial rate limiter ──────────────────────────────────────

class RequestQueue {
  private maxConcurrent: number;
  private minGapMs: number;
  private inFlight = 0;
  private lastStartTime = 0;
  private waiters: (() => void)[] = [];

  constructor(maxConcurrent: number, minGapMs: number) {
    this.maxConcurrent = maxConcurrent;
    this.minGapMs = minGapMs;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    // Wait for a free slot if at capacity
    while (this.inFlight >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
    }
    // Claim slot synchronously (no await between check and increment)
    this.inFlight++;
    // Enforce minimum gap between consecutive request starts
    const now = Date.now();
    const elapsed = now - this.lastStartTime;
    if (elapsed < this.minGapMs) {
      await sleep(this.minGapMs - elapsed);
    }
    this.lastStartTime = Date.now();
  }

  private release(): void {
    this.inFlight--;
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      next();
    }
  }
}

/**
 * Single global serial queue — ensures only 1 Gemini API call at a time.
 * 7s gap → ~8.5 RPM effective, safely under the 10 RPM free-tier limit
 * for gemini-2.5-flash (the most restrictive model).
 */
const globalQueue = new RequestQueue(1, 7000);

export class GeminiProvider implements AIProvider {
  name = "gemini";
  private client: GoogleGenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is required");
    this.client = new GoogleGenAI({ apiKey: key });
  }

  private buildConfig(options: GenerateOptions) {
    const config: Record<string, unknown> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens ?? 8192,
    };
    if (options.responseFormat === "json") {
      config.responseMimeType = "application/json";
      if (options.responseSchema) {
        config.responseSchema = options.responseSchema;
      }
    }
    return config;
  }

  private buildContents(options: GenerateOptions) {
    return options.messages.map((msg) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || GEMINI_MODELS.fast;
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await globalQueue.run(() =>
          this.client.models.generateContent({ model, contents, config })
        );

        return {
          content: response.text || "",
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          },
        };
      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const base = is503(error) ? BASE_DELAY_503_MS : BASE_DELAY_MS;
          const baseDelay = base * Math.pow(2, attempt);
          const jitter = baseDelay * (0.5 + Math.random());
          const delay = Math.round(Math.min(jitter, 120_000)); // Cap at 2 min
          const errorType = is503(error) ? "503 overload" : "rate limit";
          console.warn(`Gemini API ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Unreachable");
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || GEMINI_MODELS.fast;
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    let lastError: unknown = new Error("All retry attempts exhausted");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Throttle only the initial API call; stream iteration happens outside the slot
        const stream = await globalQueue.run(() =>
          this.client.models.generateContentStream({ model, contents, config })
        );

        for await (const chunk of stream) {
          yield {
            content: chunk.text || "",
            done: false,
          };
        }

        yield { content: "", done: true };
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const base = is503(error) ? BASE_DELAY_503_MS : BASE_DELAY_MS;
          const baseDelay = base * Math.pow(2, attempt);
          const jitter = baseDelay * (0.5 + Math.random());
          const delay = Math.round(Math.min(jitter, 120_000));
          const errorType = is503(error) ? "503 overload" : "rate limit";
          console.warn(`Gemini stream ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}

// Schema helpers for structured output
export const GeminiSchemas = {
  techStack: {
    type: Type.OBJECT,
    properties: {
      languages: { type: Type.ARRAY, items: { type: Type.STRING } },
      frameworks: { type: Type.ARRAY, items: { type: Type.STRING } },
      databases: { type: Type.ARRAY, items: { type: Type.STRING } },
      tools: { type: Type.ARRAY, items: { type: Type.STRING } },
      styling: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["languages", "frameworks", "databases", "tools", "styling"],
  },

  architecture: {
    type: Type.OBJECT,
    properties: {
      pattern: { type: Type.STRING },
      description: { type: Type.STRING },
      layers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            files: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["name", "description", "files"],
        },
      },
      entryPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["pattern", "description", "layers", "entryPoints"],
  },

  quizQuestions: {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.NUMBER },
            topic: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            explanation: { type: Type.STRING },
          },
          required: ["id", "question", "options", "correctAnswer", "topic", "difficulty", "explanation"],
        },
      },
    },
    required: ["questions"],
  },

  learningPath: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      description: { type: Type.STRING },
      modules: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            techStack: { type: Type.STRING },
            lessons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  keyConceptsFromCode: { type: Type.STRING },
                  resources: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        title: { type: Type.STRING },
                        url: { type: Type.STRING },
                        type: { type: Type.STRING },
                        source: { type: Type.STRING },
                      },
                      required: ["title", "url", "type", "source"],
                    },
                  },
                },
                required: ["id", "title", "description", "keyConceptsFromCode", "resources"],
              },
            },
          },
          required: ["id", "title", "description", "techStack", "lessons"],
        },
      },
    },
    required: ["title", "description", "modules"],
  },

  exercises: {
    type: Type.OBJECT,
    properties: {
      exercises: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            type: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            title: { type: Type.STRING },
            prompt: { type: Type.STRING },
            originalCode: { type: Type.STRING },
            modifiedCode: { type: Type.STRING },
            expectedAnswer: { type: Type.STRING },
            hints: { type: Type.ARRAY, items: { type: Type.STRING } },
            relatedFile: { type: Type.STRING },
            // MCQ / output_prediction fields
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctOptionIndex: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
          },
          required: ["id", "type", "difficulty", "title", "prompt", "originalCode", "expectedAnswer", "hints", "relatedFile", "options", "correctOptionIndex", "explanation"],
        },
      },
    },
    required: ["exercises"],
  },

  // ─── Learning Path V2 Pipeline Schemas ───────────────────────────

  conceptExtraction: {
    type: Type.OBJECT,
    properties: {
      concepts: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            category: { type: Type.STRING },
            relevanceScore: { type: Type.NUMBER },
            fileReferences: { type: Type.ARRAY, items: { type: Type.STRING } },
            moduleGroup: { type: Type.STRING },
          },
          required: ["name", "category", "relevanceScore", "fileReferences", "moduleGroup"],
        },
      },
    },
    required: ["concepts"],
  },

  dependencyGraph: {
    type: Type.OBJECT,
    properties: {
      nodes: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            index: { type: Type.NUMBER },
            prerequisites: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            difficulty: { type: Type.NUMBER },
            estimatedMinutes: { type: Type.NUMBER },
          },
          required: ["index", "prerequisites", "difficulty", "estimatedMinutes"],
        },
      },
      gapAnalysis: {
        type: Type.OBJECT,
        properties: {
          likelyKnown: { type: Type.ARRAY, items: { type: Type.STRING } },
          focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
          summary: { type: Type.STRING },
        },
        required: ["likelyKnown", "focusAreas", "summary"],
      },
    },
    required: ["nodes", "gapAnalysis"],
  },

  lessonContent: {
    type: Type.OBJECT,
    properties: {
      lessons: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            conceptIndex: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            inYourCodebase: { type: Type.STRING },
            keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["conceptIndex", "explanation", "inYourCodebase", "keyTakeaways", "tags"],
        },
      },
    },
    required: ["lessons"],
  },

  resourceCuration: {
    type: Type.OBJECT,
    properties: {
      resources: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            conceptIndex: { type: Type.NUMBER },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  platform: { type: Type.STRING },
                  title: { type: Type.STRING },
                  url: { type: Type.STRING },
                  type: { type: Type.STRING },
                  intent: { type: Type.STRING },
                  priceTier: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  estimatedDuration: { type: Type.STRING },
                  whyThisResource: { type: Type.STRING },
                },
                required: ["platform", "title", "url", "type", "intent", "priceTier", "difficulty", "estimatedDuration", "whyThisResource"],
              },
            },
          },
          required: ["conceptIndex", "recommendations"],
        },
      },
    },
    required: ["resources"],
  },
};
