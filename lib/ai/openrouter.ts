import OpenAI from "openai";
import type { AIProvider, GenerateOptions, GenerateResult, StreamChunk } from "./provider";
import { OPENROUTER_MODELS } from "@/lib/constants";

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 10000;
const BASE_DELAY_503_MS = 20000;

function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 429 || error.status === 503 || error.status === 502;
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("fetch failed") || msg.includes("socket") || msg.includes("ECONNRESET")) return true;
    if (msg.includes("other side closed") || msg.includes("network")) return true;
  }
  return false;
}

function is503(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    return error.status === 503 || error.status === 502;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Global concurrent rate limiter ──────────────────────────────────

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
    // Re-check condition after each wake-up to prevent exceeding maxConcurrent
    // when multiple waiters are released by concurrent release() calls.
    while (this.inFlight >= this.maxConcurrent) {
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
      });
      // After being woken, re-check — another waiter may have claimed the slot
    }
    this.inFlight++;
    const now = Date.now();
    const elapsed = now - this.lastStartTime;
    if (this.minGapMs > 0 && elapsed < this.minGapMs) {
      await sleep(this.minGapMs - elapsed);
    }
    this.lastStartTime = Date.now();
  }

  private release(): void {
    this.inFlight--;
    // Only wake one waiter — it will re-check the condition in acquire()
    if (this.waiters.length > 0) {
      const next = this.waiters.shift()!;
      next();
    }
  }
}

/**
 * Concurrent queue for OpenRouter paid tier.
 * 5 concurrent requests, no minimum gap.
 */
const globalQueue = new RequestQueue(5, 0);

// ─── Schema translation ─────────────────────────────────────────────

/**
 * Convert Google Gemini Type-based schema to standard JSON Schema.
 * Google uses { type: Type.STRING } etc, OpenAI uses { type: "string" }.
 */
function convertGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(schema)) {
    if (key === "type") {
      // Google Type enum values: STRING, NUMBER, BOOLEAN, OBJECT, ARRAY, INTEGER
      const typeStr = String(value).toLowerCase();
      result.type = typeStr;
    } else if (key === "properties" && typeof value === "object" && value !== null) {
      const props: Record<string, unknown> = {};
      for (const [propKey, propVal] of Object.entries(value as Record<string, unknown>)) {
        props[propKey] = convertGeminiSchema(propVal as Record<string, unknown>);
      }
      result.properties = props;
    } else if (key === "items" && typeof value === "object" && value !== null) {
      result.items = convertGeminiSchema(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  // Add additionalProperties: false for objects (required by strict mode)
  if (result.type === "object" && result.properties) {
    result.additionalProperties = false;
  }

  return result;
}

// ─── Provider ────────────────────────────────────────────────────────

export class OpenRouterProvider implements AIProvider {
  name = "openrouter";
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) throw new Error("OPENROUTER_API_KEY is required");
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: key,
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const model = options.model || OPENROUTER_MODELS.fast;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = options.messages.map((msg) => ({
      role: msg.role === "system" ? "system" as const : msg.role === "user" ? "user" as const : "assistant" as const,
      content: msg.content,
    }));

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
        };

        if (options.responseFormat === "json") {
          if (options.responseSchema) {
            requestParams.response_format = {
              type: "json_schema",
              json_schema: {
                name: "response",
                strict: true,
                schema: convertGeminiSchema(options.responseSchema),
              },
            } as OpenAI.Chat.ChatCompletionCreateParams["response_format"];
          } else {
            requestParams.response_format = { type: "json_object" };
          }
        }

        const response = await globalQueue.run(() =>
          this.client.chat.completions.create(requestParams)
        );

        return {
          content: response.choices[0]?.message?.content || "",
          usage: {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
          },
        };
      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const base = is503(error) ? BASE_DELAY_503_MS : BASE_DELAY_MS;
          const baseDelay = base * Math.pow(2, attempt);
          const jitter = baseDelay * (0.5 + Math.random());
          const delay = Math.round(Math.min(jitter, 120_000));
          const errorType = is503(error) ? "503 overload" : "rate limit";
          console.warn(`OpenRouter API ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Unreachable");
  }

  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const model = options.model || OPENROUTER_MODELS.fast;
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = options.messages.map((msg) => ({
      role: msg.role === "system" ? "system" as const : msg.role === "user" ? "user" as const : "assistant" as const,
      content: msg.content,
    }));

    let lastError: unknown = new Error("All retry attempts exhausted");
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
          stream: true,
        };

        if (options.responseFormat === "json") {
          if (options.responseSchema) {
            requestParams.response_format = {
              type: "json_schema",
              json_schema: {
                name: "response",
                strict: true,
                schema: convertGeminiSchema(options.responseSchema),
              },
            } as OpenAI.Chat.ChatCompletionCreateParams["response_format"];
          } else {
            requestParams.response_format = { type: "json_object" };
          }
        }

        const stream = await globalQueue.run(() =>
          this.client.chat.completions.create(requestParams)
        );

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content || "";
          yield { content, done: false };
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
          console.warn(`OpenRouter stream ${errorType} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${Math.round(delay / 1000)}s...`);
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}

// ─── Re-export schema converter ──────────────────────────────────────

// Import the raw Gemini-format schemas and convert them.
// These are used by pipeline code that passes responseSchema.
// NOTE: After migration, consider rewriting schemas as plain JSON Schema
// directly, removing the need for conversion.
export { convertGeminiSchema };
