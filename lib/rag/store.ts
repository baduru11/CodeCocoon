import { createClient } from "@/lib/supabase/server";
import { embed, embedQuery } from "./embedder";
import type { CodeChunk } from "./types";

/**
 * Index code chunks into Supabase pgvector.
 * Embeds all chunks and batch-inserts them.
 */
export async function indexChunks(
  projectId: string,
  chunks: CodeChunk[]
): Promise<void> {
  if (chunks.length === 0) return;

  const supabase = await createClient();

  // Delete existing chunks for this project (re-indexing)
  await supabase.from("code_chunks").delete().eq("project_id", projectId);

  // Embed all chunk contents
  const texts = chunks.map((c) => c.content);
  const embeddings = await embed(texts);

  // Batch insert (Supabase has row limits, insert in groups of 100)
  const BATCH_SIZE = 100;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = embeddings.slice(i, i + BATCH_SIZE);

    const rows = batch.map((chunk, j) => ({
      project_id: projectId,
      file_path: chunk.file,
      language: chunk.language,
      chunk_type: chunk.type,
      chunk_name: chunk.name,
      start_line: chunk.startLine,
      end_line: chunk.endLine,
      content: chunk.content,
      embedding: JSON.stringify(batchEmbeddings[j]),
    }));

    const { error } = await supabase.from("code_chunks").insert(rows);
    if (error) {
      throw new Error(`Failed to insert code chunks: ${error.message}`);
    }
  }
}

/**
 * Query similar code chunks using pgvector cosine similarity.
 * Returns null if the query fails (caller should fall back to truncation).
 */
export async function queryChunks(
  projectId: string,
  queryText: string,
  topK = 8
): Promise<CodeChunk[] | null> {
  try {
    const supabase = await createClient();
    const queryEmbedding = await embedQuery(queryText);

    const { data, error } = await supabase.rpc("match_code_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_project_id: projectId,
      match_count: topK,
    });

    if (error) {
      console.warn("pgvector query failed:", error.message);
      return null;
    }

    if (!data || data.length === 0) return null;

    return data.map((row: Record<string, unknown>) => ({
      file: String(row.file_path),
      language: String(row.language || "unknown"),
      type: String(row.chunk_type || "block") as CodeChunk["type"],
      name: String(row.chunk_name || ""),
      startLine: Number(row.start_line || 0),
      endLine: Number(row.end_line || 0),
      content: String(row.content),
    }));
  } catch (error) {
    console.warn("RAG query failed:", error);
    return null;
  }
}

/**
 * Delete all chunks for a project.
 */
export async function deleteIndex(projectId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("code_chunks").delete().eq("project_id", projectId);
}

/**
 * Check if a project already has indexed chunks.
 */
export async function hasIndex(projectId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("code_chunks")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);

  if (error) return false;
  return (count || 0) > 0;
}
