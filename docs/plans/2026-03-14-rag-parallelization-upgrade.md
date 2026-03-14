# RAG + Pipeline Parallelization Upgrade

**Date:** 2026-03-14
**Status:** Approved

## Problem Statement

Three architectural problems in the current pipeline:

1. **Blind context dumping** — All files are concatenated into one string, truncated at 80k chars / 150 lines per file, and dumped into every prompt regardless of relevance.
2. **Fully sequential execution** — All ~17-22 AI calls run one at a time with a 7-second gap (free-tier Gemini rate limiter), even when steps have no data dependency on each other.
3. **Silent quality degradation** — Large repos hit truncation limits that cut functions mid-way. No error is thrown; output quality just silently drops.

## Solution Overview

Four phases, buildable in parallel where noted:

| Phase | What | Key Dependency |
|-------|------|---------------|
| 0 | Switch from Google Gemini SDK to OpenRouter (OpenAI-compatible) | `openai` npm package |
| 1 | Semantic code chunking with web-tree-sitter (WASM) | `web-tree-sitter` |
| 2 | Embedding + pgvector storage via Supabase | `@huggingface/transformers`, pgvector extension |
| 3 | Per-step RAG context retrieval replacing truncated file dumps | Phases 1 + 2 |
| 4 | Pipeline parallelization with dependency-based execution | Phase 0 |
| 5 | Codebase chat panel (RAG + general LLM knowledge) | Phases 0 + 2 |

Phases 0 and 1-2 are independent and can be built in parallel. Phase 3 depends on 1+2. Phase 4 depends on 0 but is independent of 1-3.

---

## Phase 0 — OpenRouter Provider Switch

### Why

The current `RequestQueue(1, 7000)` enforces 1 concurrent request with 7-second gaps (~8.5 RPM) for Google's free-tier limit. OpenRouter paid tier has no platform-level rate limit ($1 balance = 1 RPS, up to 500 RPS). Switching enables true parallelism in Phase 4.

### Models

Same models, routed through OpenRouter:
- **fast**: `google/gemini-2.5-flash-lite` (analysis, classification, graph building, resource curation)
- **deep**: `google/gemini-2.5-flash` (tutorial writing, lesson content, exercises)

### Files touched

- `lib/ai/gemini.ts` → rename to `lib/ai/openrouter.ts`
- `lib/ai/provider.ts` — no changes (AIProvider interface stays same)
- `lib/constants.ts` — update model IDs to OpenRouter format
- `.env.local` — `OPENROUTER_API_KEY` replaces `GEMINI_API_KEY`
- All files importing `GeminiProvider` / `GeminiSchemas`

### Changes

1. **SDK swap**: Replace `@google/genai` with `openai` npm package (OpenRouter is OpenAI-compatible)
2. **Rate limiter**: `RequestQueue(1, 7000)` → `RequestQueue(5, 0)` — 5 concurrent, no gap
3. **Schema translation**: Google's `Type.STRING` / `Type.OBJECT` → standard JSON Schema format. Write a small adapter function to convert `GeminiSchemas` to OpenAI's `response_format: { type: "json_schema", json_schema: {...} }`
4. **Retry logic**: Detect OpenAI-style errors (`error.status === 429/503`) instead of Google-specific strings (`RESOURCE_EXHAUSTED`, etc.)
5. **Streaming**: Keep `generateStream()` — OpenRouter supports SSE streaming via OpenAI SDK
6. **Env**: `OPENROUTER_API_KEY` required, `GEMINI_API_KEY` removed

### Risk

Structured output (JSON schema enforcement) works differently between Google and OpenAI APIs. Need to verify that the translated schemas produce equivalent structured output through OpenRouter.

---

## Phase 1 — Semantic Chunking with web-tree-sitter

### New files

- `lib/rag/chunker.ts`
- `lib/rag/grammars/` — WASM grammar files

### Dependencies

- `web-tree-sitter` (WASM-based, works in Node.js API routes)
- WASM grammar files for: TypeScript, JavaScript, Python, Go, Java

### Chunk type

```ts
interface CodeChunk {
  file: string;          // relative file path
  language: string;      // detected language
  type: "function" | "class" | "module" | "block";
  name: string;          // function/class name, or "lines-100-400" for fallback
  startLine: number;
  endLine: number;
  content: string;
}
```

### Logic

1. Detect language from file extension
2. If WASM grammar available → parse AST, extract chunks at function/class/module boundaries
3. If no grammar available → sliding window fallback (300 lines, 50-line overlap)
4. Skip empty files
5. Files with no parseable structures (pure config JSON, etc.) → treat as single chunk
6. Very large functions (>300 lines) → chunk at nested scope boundaries

### Grammar loading

- Load `.wasm` files from `lib/rag/grammars/` directory
- Lazy-load per language — only load grammars for languages detected in the repo
- Cache parser instances as module-level singletons (survive across API requests)

---

## Phase 2 — Embedding + pgvector Storage

### New files

- `lib/rag/embedder.ts`
- `lib/rag/store.ts`
- `lib/rag/index.ts` (RAGService class)

### Supabase migration

```sql
create extension if not exists vector;

create table code_chunks (
  id bigint generated always as identity primary key,
  project_id text not null,
  file_path text not null,
  language text,
  chunk_type text,
  chunk_name text,
  start_line int,
  end_line int,
  content text not null,
  embedding vector(384) not null
);

create index on code_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index on code_chunks (project_id);
```

384 dimensions = `all-MiniLM-L6-v2` output size.

### embedder.ts

- Singleton `@huggingface/transformers` pipeline with `all-MiniLM-L6-v2`
- `embed(texts: string[]): Promise<number[][]>` — batch embedding
- Cache model instance at module level, lazy-init on first call
- First call downloads ~80MB model (one-time cost per server restart)

### store.ts

- `indexChunks(projectId, chunks)` — embed all chunks → batch upsert into `code_chunks`
- `query(projectId, queryText, topK)` — embed query → pgvector nearest neighbor (`<=>` cosine distance)
- `deleteIndex(projectId)` — delete all chunks for a project
- `hasIndex(projectId)` — check if chunks exist (skip re-embedding for same repo)
- Uses Supabase client + `rpc()` for vector similarity queries

### index.ts (RAGService)

```ts
class RAGService {
  async indexRepo(projectId: string, files: RepoFile[]): Promise<void>
  // chunk files → embed → store in pgvector

  async query(projectId: string, query: string, topK?: number): Promise<CodeChunk[]>
  // embed query → pgvector nearest neighbor → return chunks

  async deleteIndex(projectId: string): Promise<void>
  // clean up old chunks for re-processing

  async hasIndex(projectId: string): Promise<boolean>
  // check if already indexed (skip re-embedding)
}
```

### Fallback

If embedding or pgvector fails at any point, `query()` returns `null`. Pipeline steps detect `null` and fall back to the existing `formatFilesTruncated()` / `formatCodeContextForPipeline()` approach. No error thrown to the user.

---

## Phase 3 — Per-Step Context Retrieval

### Files touched

- `lib/ai/prompts.ts` — add RAG-aware prompt variants
- `lib/ai/tutorial-pipeline.ts` — use RAG queries
- `lib/ai/learning-pipeline.ts` — use RAG queries
- `app/api/process/route.ts` — add indexing step, pass RAGService

### Query strategy

All queries are natural language (sentence transformers work best with natural language, not keyword bags).

| Step | Query | topK |
|------|-------|------|
| 2 Tech Stack | "Project configuration files declaring dependencies, frameworks, and build tools" | 10 |
| 3 Architecture | "Main entry points, routing definitions, middleware, and application structure" | 10 |
| 4 Key Files | "Core modules with the most important business logic and data models" | 8 |
| 5a Abstractions | "Core abstractions, design patterns, and architectural concepts in this codebase" | 12 |
| 5b Relationships | Dynamic: one query per abstraction name | 6 each |
| 5d Chapters | Dynamic: `"How {abstractionName} is implemented and used in this codebase"` | 8 |
| 6a Concepts | Dynamic: `"Code related to {roleName} responsibilities: {roleDescription}"` | 10 |
| 6b Dep Graph | "Module dependencies, imports, and how components connect to each other" | 8 |
| 6c Lessons | Dynamic: one query per concept name | 6 each |
| 6d Resources | No RAG — this step uses concept metadata only, no code context | — |
| 7 Exercises | Dynamic: `"Code implementing {conceptName} with functions and logic suitable for exercises"` | 10 |

### Retrieval approach

- Always return topK results — no cosine distance threshold cutoff
- Let the LLM judge relevance from the retrieved chunks
- Fallback only on total failure (RAG returns `null` because indexing failed)

### Prompt format for RAG results

Replace `formatFilesTruncated()` output with:

```
--- {file}:{startLine}-{endLine} ({type}: {name}) ---
{content}
```

### What gets removed

- `formatFilesTruncated()` calls for RAG-powered steps
- `formatCodeContextForPipeline()` calls for RAG-powered steps
- 80k char / 150 line truncation limits for RAG-powered steps
- Keep `formatFilesStructureOnly()` as a cheap supplement for tech stack detection

### Pipeline signature changes

```ts
runTutorialPipeline(ai, files, projectName, send, checkAborted, rag?: RAGService)
runLearningPipeline(ai, input, send, checkAborted, rag?: RAGService)
```

Optional `rag` parameter — if `null`/`undefined`, falls back to current truncation behavior.

---

## Phase 4 — Pipeline Parallelization

### Files touched

- `app/api/process/route.ts` — restructure into dependency-based parallel execution
- `lib/ai/learning-pipeline.ts` — expose individual step functions
- `lib/ai/tutorial-pipeline.ts` — expose individual step functions

### Execution graph

```
Step 1: Fetch files
    |
Step 1.5: RAG indexing (chunk -> embed -> store)
    |
    +-- Wave 1 (4 parallel):
    |   +-- Step 2:  Tech Stack          (fast)
    |   +-- Step 3:  Architecture        (fast)
    |   +-- Step 4:  Key Files           (fast)
    |   +-- Step 5a: Abstractions        (fast)
    |
    +-- After 5a:
    |   +-- Step 5b: Relationships       (fast)
    |
    +-- After 5b + Step 2:
    |   +-- Step 5c: Chapter Order       (fast)
    |   +-- Step 6a: Concepts            (fast)
    |
    +-- After 5c:
    |   +-- Step 5d: Chapters 1->N       (deep, sequential per chapter)
    |
    +-- After 6a + Step 3:
    |   +-- Step 6b: Dep Graph           (fast)  \
    |   +-- Step 6c: Lessons             (deep)   | parallel
    |   +-- Step 7:  Exercises           (deep)  /
    |
    +-- After 6b + 6c:
        +-- Step 6d: Resources           (fast)
```

### Critical path

`Fetch -> Index -> Abstractions -> Relationships -> Chapter Order -> Chapters(N)`

= 3 AI calls + N chapter calls on the longest path (typically 8-13 total)

All other work (tech stack, architecture, key files, concepts, dep graph, lessons, exercises, resources) runs in parallel alongside chapter writing.

**Current**: ~17-22 sequential AI calls
**Optimized**: ~8-13 on critical path = roughly 1.5-2x wall-clock speedup

**Implementation note**: The actual implementation parallelizes at the outer level only — `runTutorialPipeline` and `runLearningPipeline` manage their own internal sequential steps. This is simpler than the fine-grained wave graph above but captures the majority of the speedup (4 parallel initial steps + exercises parallel with learning). The exported step functions enable deeper parallelization in a future iteration if needed.

### Implementation: dependency-based step executor

```ts
async function runStep(name: string, deps: string[], fn: () => Promise<unknown>) {
  await Promise.all(deps.map(d => waitFor(d)));
  send("step_start", name);
  const result = await fn();
  results.set(name, result);
  resolve(name);
  return result;
}

await Promise.all([
  runStep("tech_stack",    ["files"],                        () => ...),
  runStep("architecture",  ["files"],                        () => ...),
  runStep("key_files",     ["files"],                        () => ...),
  runStep("abstractions",  ["files"],                        () => ...),
  runStep("relationships", ["abstractions"],                 () => ...),
  runStep("chapter_order", ["relationships", "tech_stack"],  () => ...),
  runStep("chapters",      ["chapter_order"],                () => ...),
  runStep("concepts",      ["relationships", "tech_stack"],  () => ...),
  runStep("dep_graph",     ["concepts", "architecture"],     () => ...),
  runStep("lessons",       ["concepts"],                     () => ...),
  runStep("exercises",     ["concepts"],                     () => ...),
  runStep("resources",     ["dep_graph", "lessons"],         () => ...),
]);
```

### Exercise improvements

Exercises now run after concept extraction (step 6a), in parallel with dep graph and lessons. Prompt receives:
- Concept list from 6a — exercises target what the user is learning
- Role profile — exercises focus on role-relevant code
- RAG query per concept: `"Code implementing {conceptName} with functions and logic suitable for exercises"`

### SSE changes

- Steps emit `step_start` / progress / completion events from inside their own function
- New event type `"indexing"` for the RAG embedding phase (step 1.5)
- Client-side progress display remains the same — steps appear in listed order, they just complete faster
- `RequestQueue(5, 0)` — 5 concurrent OpenRouter requests, no minimum gap

### Rate limiter update

```ts
// Before (free-tier Gemini):
const globalQueue = new RequestQueue(1, 7000);

// After (paid OpenRouter):
const globalQueue = new RequestQueue(5, 0);
```

---

## Phase 5 — Codebase Chat (RAG + LLM)

### What

A collapsible chat panel on the results page where users ask questions about their analyzed codebase. Uses RAG to retrieve relevant code chunks, enriched with project context (tech stack, architecture, learning path, skill level). Falls back to general LLM knowledge when RAG has no relevant results.

### UI

- Floating chat button (bottom-right corner) on the results page
- Opens a slide-out drawer panel (~400px wide)
- Message history with user/assistant bubbles
- Input field with send button
- Streaming response display (SSE)
- Shows which code files were referenced in the answer
- Message history stored in React state (not persisted to DB — ephemeral per session)

### API Route

`POST /api/chat` — accepts `{ projectId, message, history, context }`, returns SSE stream.

**System prompt** includes:
- Project tech stack, architecture pattern
- User's skill level and role
- Learning path concepts (if available)
- RAG-retrieved code chunks relevant to the user's question

**Request flow:**
1. Receive user message + project context
2. Query RAG: `embed(message) → pgvector search → topK chunks`
3. Build system prompt with project context + retrieved chunks
4. Stream LLM response back via SSE
5. If RAG returns no results, proceed with just project metadata (general knowledge mode)

### New files

- `app/api/chat/route.ts` — SSE streaming chat endpoint
- `components/chat/chat-panel.tsx` — drawer UI with message list + input
- `components/chat/chat-message.tsx` — individual message bubble
- `hooks/use-chat.ts` — manages message state, SSE connection, streaming

### Integration

The chat panel is rendered inside `app/(main)/results/page.tsx` as a fixed-position overlay. It receives `activeSession` data (repoName, techStack, skillLevel, learningPath) as props to build the context.

---

## Constraints

- Next.js 16 App Router, TypeScript only — no Python, no separate services
- `web-tree-sitter` (WASM) instead of native `tree-sitter` (avoids node-gyp issues in Next.js)
- `@huggingface/transformers` (updated package name, replaces deprecated `@xenova/transformers`)
- API routes must use `runtime: "nodejs"` (required for WASM loading + transformers)
- Do not break existing SSE streaming progress events
- Supabase schema change: new `code_chunks` table with pgvector — no changes to existing tables
- Graceful fallback: if RAG indexing fails, silently fall back to current truncation approach
- Keep existing `GeminiSchemas` structure, just translate to JSON Schema format for OpenRouter

## Deliverables

| # | File | Purpose |
|---|------|---------|
| 1 | `lib/ai/openrouter.ts` | OpenRouter provider (replaces gemini.ts) |
| 2 | `lib/rag/chunker.ts` | web-tree-sitter semantic chunker with line-based fallback |
| 3 | `lib/rag/grammars/*.wasm` | WASM grammar files for supported languages |
| 4 | `lib/rag/embedder.ts` | @huggingface/transformers embedding singleton |
| 5 | `lib/rag/store.ts` | Supabase pgvector client with per-project collections |
| 6 | `lib/rag/index.ts` | RAGService class combining chunker + embedder + store |
| 7 | `supabase/migrations/xxx_code_chunks.sql` | pgvector table + indexes |
| 8 | `lib/ai/prompts.ts` | Updated prompts with RAG context format |
| 9 | `lib/ai/tutorial-pipeline.ts` | RAG-aware tutorial pipeline |
| 10 | `lib/ai/learning-pipeline.ts` | RAG-aware learning pipeline, split step functions |
| 11 | `app/api/process/route.ts` | Dependency-based parallel executor + RAG indexing step |
| 12 | `lib/constants.ts` | Updated model IDs for OpenRouter |
| 13 | `app/api/chat/route.ts` | SSE streaming chat endpoint with RAG |
| 14 | `components/chat/chat-panel.tsx` | Collapsible chat drawer UI |
| 15 | `components/chat/chat-message.tsx` | Message bubble component |
| 16 | `hooks/use-chat.ts` | Chat state management + SSE streaming hook |
