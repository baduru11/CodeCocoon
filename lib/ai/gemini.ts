import { GoogleGenAI, Type } from "@google/genai";
import type { AIProvider, GenerateOptions, GenerateResult, StreamChunk } from "./provider";
import { GEMINI_MODELS } from "@/lib/constants";

const MAX_RETRIES = 4;

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED")) return true;
    if (msg.includes("503") || msg.includes("UNAVAILABLE")) return true;
    if (msg.includes("fetch failed") || msg.includes("socket") || msg.includes("ECONNRESET")) return true;
    if (msg.includes("other side closed") || msg.includes("network")) return true;
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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Sliding-window rate limiter ─────────────────────────────────────
// Tracks every actual API call timestamp in a 60s window.
// Waits until the window has room before allowing any request (including retries).

class SlidingWindowLimiter {
  private timestamps: number[] = [];
  private maxPerMinute: number;
  private lock: Promise<void> = Promise.resolve();

  constructor(maxPerMinute: number) {
    this.maxPerMinute = maxPerMinute;
  }

  /** Wait until we can make a request without exceeding RPM, then record it. */
  async waitForSlot(): Promise<void> {
    // Serialize access — only one caller can check + claim a slot at a time
    const prev = this.lock;
    let resolve!: () => void;
    this.lock = new Promise<void>((r) => { resolve = r; });

    await prev; // wait for previous caller to finish

    try {
      for (;;) {
        const now = Date.now();
        // Prune timestamps older than 60s
        this.timestamps = this.timestamps.filter((t) => now - t < 60_000);

        if (this.timestamps.length < this.maxPerMinute) {
          // We have room — claim the slot
          this.timestamps.push(now);
          return;
        }

        // Wait until the oldest request falls out of the 60s window
        const waitMs = 60_000 - (now - this.timestamps[0]) + 200;
        console.log(`Gemini rate limiter: waiting ${Math.round(waitMs / 1000)}s for RPM window...`);
        await sleep(waitMs);
      }
    } finally {
      resolve(); // release the lock for the next caller
    }
  }
}

/** Persist singleton across Next.js dev hot reloads via globalThis */
const g = globalThis as unknown as { __geminiLimiter?: SlidingWindowLimiter };
if (!g.__geminiLimiter) {
  // 15 RPM for free tier — use 10 effective to have safe margin
  g.__geminiLimiter = new SlidingWindowLimiter(10);
}
const limiter = g.__geminiLimiter;

/** Map provider-agnostic model labels to actual Gemini model names */
function resolveModel(label: string | undefined): string {
  if (!label || label === "fast") return GEMINI_MODELS.fast;
  if (label === "deep") return GEMINI_MODELS.deep;
  return label; // already a full model name
}

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
    const model = resolveModel(options.model);
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Wait for RPM window BEFORE every call (including retries)
      await limiter.waitForSlot();

      try {
        const response = await this.client.models.generateContent({
          model,
          contents,
          config,
        });

        return {
          content: response.text || "",
          usage: {
            inputTokens: response.usageMetadata?.promptTokenCount || 0,
            outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          },
        };
      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          console.log(
            `Gemini API retry (${attempt + 1}/${MAX_RETRIES}) — will wait for rate limit window`
          );
          continue; // next iteration calls waitForSlot() again
        }
        throw error;
      }
    }

    throw new Error("All retry attempts exhausted");
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const model = resolveModel(options.model);
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    let lastError: unknown = new Error("All retry attempts exhausted");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await limiter.waitForSlot();

      try {
        const stream = await this.client.models.generateContentStream({
          model,
          contents,
          config,
        });

        for await (const chunk of stream) {
          yield { content: chunk.text || "", done: false };
        }
        yield { content: "", done: true };
        return;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          console.log(
            `Gemini stream retry (${attempt + 1}/${MAX_RETRIES}) — will wait for rate limit window`
          );
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
};
