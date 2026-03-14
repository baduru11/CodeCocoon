import type { RepoFile } from "@/types/github";
import type { CodeChunk } from "./types";
import { chunkFiles } from "./chunker";
import { indexChunks, queryChunks, deleteIndex, hasIndex } from "./store";

export type { CodeChunk } from "./types";

export function formatChunksForPrompt(chunks: CodeChunk[]): string {
  return chunks
    .map((c) => `--- ${c.file}:${c.startLine}-${c.endLine} (${c.type}: ${c.name}) ---\n${c.content}`)
    .join("\n\n");
}

export class RAGService {
  async indexRepo(projectId: string, files: RepoFile[]): Promise<void> {
    const alreadyIndexed = await hasIndex(projectId);
    if (alreadyIndexed) {
      console.log(`RAG: Project ${projectId} already indexed, skipping.`);
      return;
    }
    const chunks = await chunkFiles(files);
    console.log(`RAG: Chunked ${files.length} files into ${chunks.length} chunks`);
    await indexChunks(projectId, chunks);
    console.log(`RAG: Indexed ${chunks.length} chunks for project ${projectId}`);
  }

  async query(projectId: string, queryText: string, topK = 8): Promise<CodeChunk[] | null> {
    return queryChunks(projectId, queryText, topK);
  }

  async deleteIndex(projectId: string): Promise<void> {
    return deleteIndex(projectId);
  }

  async hasIndex(projectId: string): Promise<boolean> {
    return hasIndex(projectId);
  }
}
