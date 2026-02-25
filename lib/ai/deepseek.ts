import OpenAI from "openai";
import type {
  AIProvider,
  GenerateOptions,
  GenerateResult,
  StreamChunk,
} from "./provider";

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 3000;

function isRetryable(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message;
    if (msg.includes("429") || msg.includes("rate")) return true;
    if (msg.includes("503") || msg.includes("UNAVAILABLE")) return true;
    if (msg.includes("fetch failed") || msg.includes("socket")) return true;
    if (msg.includes("ECONNRESET") || msg.includes("timeout")) return true;
  }
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: number }).status;
    if (status === 429 || status === 503 || status === 502) return true;
  }
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DeepSeekProvider implements AIProvider {
  name = "deepseek";
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error("DEEPSEEK_API_KEY is required");
    this.client = new OpenAI({
      baseURL: "https://api.deepseek.com",
      apiKey: key,
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    // DeepSeek uses "deepseek-chat" for all non-reasoning tasks
    const model = "deepseek-chat";

    const messages: OpenAI.ChatCompletionMessageParam[] = options.messages.map(
      (msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      })
    );

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model,
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.maxTokens ?? 8192,
          ...(options.responseFormat === "json"
            ? { response_format: { type: "json_object" as const } }
            : {}),
        });

        const content = response.choices[0]?.message?.content || "";
        return {
          content,
          usage: {
            inputTokens: response.usage?.prompt_tokens || 0,
            outputTokens: response.usage?.completion_tokens || 0,
          },
        };
      } catch (error) {
        if (attempt < MAX_RETRIES && isRetryable(error)) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(
            `DeepSeek retrying in ${Math.round(delay / 1000)}s... (attempt ${attempt + 1}/${MAX_RETRIES + 1})`
          );
          await sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw new Error("Unreachable");
  }

  async *generateStream(
    options: GenerateOptions
  ): AsyncGenerator<StreamChunk> {
    const model = "deepseek-chat";

    const messages: OpenAI.ChatCompletionMessageParam[] = options.messages.map(
      (msg) => ({
        role: msg.role === "user" ? ("user" as const) : ("assistant" as const),
        content: msg.content,
      })
    );

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 8192,
      stream: true,
      ...(options.responseFormat === "json"
        ? { response_format: { type: "json_object" as const } }
        : {}),
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      yield { content, done: false };
    }
    yield { content: "", done: true };
  }
}
