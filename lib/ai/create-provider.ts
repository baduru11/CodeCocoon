import type { AIProvider } from "./provider";
import { DeepSeekProvider } from "./deepseek";
import { GeminiProvider } from "./gemini";

/**
 * Create the best available AI provider.
 * Prefers DeepSeek (no rate limits, cheap) over Gemini (strict free-tier RPM).
 */
export function createAIProvider(): AIProvider {
  if (process.env.DEEPSEEK_API_KEY) {
    return new DeepSeekProvider();
  }
  if (process.env.GEMINI_API_KEY) {
    return new GeminiProvider();
  }
  throw new Error(
    "No AI API key configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY in .env.local"
  );
}
