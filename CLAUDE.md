# CLAUDE.md

## Project

CodeCocoon — Next.js app that analyzes GitHub repos (or uploaded code) using Gemini AI, generating personalized learning paths and exercises based on user skill level.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (auth + DB), Google Gemini AI, Octokit (GitHub API). Path alias: `@/*` → project root.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run lint     # ESLint (core-web-vitals + typescript)
```

## Env (`.env.local`)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` (required). `GITHUB_TOKEN` (optional, raises rate limit to 5000 req/hr).

## Structure

- `app/(auth)/` — Login, OAuth callback
- `app/(main)/` — Feature pages: connect, configure, processing, analyze, assess, learn, exercises, results, upload, dashboard, history
- `app/api/` — Mostly POST (JSON or SSE). Exceptions: `GET /api/github/repos`, `GET|DELETE /api/projects/[id]`. Key: `/api/process` (main pipeline)
- `lib/ai/` — `GeminiProvider` with structured output schemas + `tutorial-pipeline.ts` (chapter generation) + `learning-pipeline.ts` (role-based presets). Models in `lib/constants.ts`: `gemini-2.5-flash-lite` (fast/analysis), `gemini-2.5-flash` (deep/learning + exercises)
- `lib/github/` — URL parsing, repo tree/file fetching (Octokit + p-limit), file filtering
- `lib/supabase/` — Client (browser), server (cookie auth), middleware (protects `/dashboard` only)
- `components/ui/` — Custom component library (`clsx` + `tailwind-merge`)
- `types/` — All TypeScript types (github, analysis, learning, exercise, tutorial, database, session, assessment)
- `hooks/` — Custom React hooks (use-processing, use-auth, use-local-storage, use-scrollspy, use-analysis, use-project-sessions)

## Key Patterns

- **Dual storage**: localStorage for anonymous users (`lib/project-sessions.ts`), Supabase for authenticated
- **AI rate limiting**: Global serial queue in `gemini.ts` — 1 concurrent request, 7s gap (~8.5 RPM, under free-tier 10 RPM limit)
- **SSE streaming**: Processing pipeline streams incremental results to client
- **Design system**: Neo-brutalist — `border-2`, `shadow-[3px_3px_0px_0px_#1E293B]`, rounded corners (`rounded-lg`/`rounded-xl`)
- **Fonts**: Space Grotesk (headings), DM Sans (body), Geist Mono (code)
- **Icons**: `lucide-react`
- **Code editors**: `react-syntax-highlighter`, `@uiw/react-codemirror`

## MCP

`.mcp.json` configures Supabase MCP server for database operations.
