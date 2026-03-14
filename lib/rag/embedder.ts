// Singleton embedding pipeline using @huggingface/transformers.
// Uses all-MiniLM-L6-v2 (384 dimensions).
// First call downloads ~80MB model; subsequent calls reuse cached instance.

let pipelineInstance: unknown = null;
let pipelineLoading: Promise<unknown> | null = null;

async function getPipeline() {
  if (pipelineInstance) return pipelineInstance;

  if (!pipelineLoading) {
    pipelineLoading = (async () => {
      const { pipeline } = await import("@huggingface/transformers");
      const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
      pipelineInstance = pipe;
      return pipe;
    })();
  }

  return pipelineLoading;
}

/**
 * Truncate text to fit within the model's effective context window.
 * all-MiniLM-L6-v2 has a max sequence length of 256 tokens (~1000 chars).
 * We truncate to ~1500 chars to ensure the most meaningful content is embedded
 * rather than just import statements at the top of large chunks.
 */
const MAX_EMBED_CHARS = 1500;

function truncateForEmbedding(text: string): string {
  if (text.length <= MAX_EMBED_CHARS) return text;
  return text.slice(0, MAX_EMBED_CHARS);
}

/**
 * Embed an array of text strings into 384-dimensional vectors.
 * Batches internally for efficiency. Long texts are truncated to fit
 * the model's context window.
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const pipe = await getPipeline() as (
    input: string[],
    options: { pooling: string; normalize: boolean }
  ) => Promise<{ tolist: () => number[][] }>;

  // Truncate texts that exceed the model's effective context window
  const truncated = texts.map(truncateForEmbedding);

  // Process in batches of 32 to avoid memory issues
  const BATCH_SIZE = 32;
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < truncated.length; i += BATCH_SIZE) {
    const batch = truncated.slice(i, i + BATCH_SIZE);
    const output = await pipe(batch, { pooling: "mean", normalize: true });
    const embeddings = output.tolist();
    allEmbeddings.push(...embeddings);
  }

  return allEmbeddings;
}

/**
 * Embed a single query string into a 384-dimensional vector.
 */
export async function embedQuery(text: string): Promise<number[]> {
  const results = await embed([text]);
  return results[0];
}
