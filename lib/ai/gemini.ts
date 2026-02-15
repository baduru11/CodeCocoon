import { GoogleGenAI, Type } from "@google/genai";
import type { AIProvider, GenerateOptions, GenerateResult, StreamChunk } from "./provider";
import { GEMINI_MODELS } from "@/lib/constants";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

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

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    const model = options.model || GEMINI_MODELS.fast;
    const contents = this.buildContents(options);
    const config = this.buildConfig(options);

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Gemini API rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`);
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
        const stream = await this.client.models.generateContentStream({
          model,
          contents,
          config,
        });

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
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.warn(`Gemini stream rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms...`);
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
};
