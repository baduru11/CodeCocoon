# CLAUDE.md

## Project

CodeCocoon — Next.js app that analyzes GitHub repos (or uploaded code) using AI (via OpenRouter), generating personalized learning paths and exercises based on user skill level.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (auth + DB), OpenRouter (OpenAI SDK), Octokit (GitHub API). Path alias: `@/*` → project root.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint (core-web-vitals + typescript)
```

## Env (`.env.local`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENROUTER_API_KEY` (required). `GITHUB_TOKEN` (optional, raises rate limit to 5000 req/hr).

## Structure

- `app/(auth)/` — Login, OAuth callback
- `app/(main)/` — Feature pages: connect, configure, processing, analyze, assess, learn, exercises, results, upload, dashboard, history
- `app/api/` — Mostly POST (JSON or SSE). Exceptions: `GET /api/github/repos`, `GET|DELETE /api/projects/[id]`. Key: `/api/process` (main pipeline), `/api/chat` (POST, SSE streaming)
- `lib/ai/` — `OpenRouterProvider` (OpenAI-compatible) + `schemas.ts` (JSON Schema definitions) + `tutorial-pipeline.ts` (chapter generation) + `learning-pipeline.ts` (role-based presets). Models in `lib/constants.ts`: `google/gemini-2.5-flash-lite` (fast/analysis), `google/gemini-2.5-flash` (deep/learning + exercises)
- `lib/github/` — URL parsing, repo tree/file fetching (Octokit + p-limit), file filtering
- `lib/rag/` — RAG pipeline: semantic chunker (web-tree-sitter), embedder (@huggingface/transformers), pgvector store, RAGService
- `lib/supabase/` — Client (browser), server (cookie auth), middleware (protects `/dashboard` only)
- `components/ui/` — Custom component library (`clsx` + `tailwind-merge`)
- `components/chat/` — Codebase chat panel (floating drawer on results page)
- `types/` — All TypeScript types (github, analysis, learning, exercise, tutorial, database, session, assessment)
- `hooks/` — Custom React hooks (use-processing, use-auth, use-local-storage, use-scrollspy, use-analysis, use-project-sessions, use-chat)

## Key Patterns

- **Dual storage**: localStorage for anonymous users (`lib/project-sessions.ts`), Supabase for authenticated
- **AI rate limiting**: Global concurrent queue in `openrouter.ts` — 5 concurrent requests, no gap (OpenRouter paid tier)
- **RAG retrieval**: Semantic chunking with tree-sitter, embedded with all-MiniLM-L6-v2, stored in Supabase pgvector. Per-step context queries replace truncated file dumps.
- **Codebase chat**: Collapsible chat panel on results page. RAG-powered Q&A about the analyzed codebase with streaming responses.
- **SSE streaming**: Processing pipeline streams incremental results to client
- **Design system**: Neo-brutalist — `border-2`, `shadow-[3px_3px_0px_0px_#1E293B]`, rounded corners (`rounded-lg`/`rounded-xl`)
- **Fonts**: Space Grotesk (headings), DM Sans (body), Geist Mono (code)
- **Icons**: `lucide-react`
- **Code editors**: `react-syntax-highlighter`, `@uiw/react-codemirror`

## MCP

`.mcp.json` configures Supabase MCP server for database operations.
