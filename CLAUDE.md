# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CodeCocoon** is a Next.js web app that helps users understand AI-generated ("vibe-coded") projects. Like a cocoon, your AI-generated code has something powerful inside — but it's all wrapped up. Users connect a GitHub repo (or paste a URL), the app fetches and analyzes the codebase using Gemini AI, then generates personalized learning paths and interactive exercises based on the user's skill level.

## Repository Structure

The repository contains a Next.js application with the following structure:
- `app/` — Next.js 16 App Router pages and API routes
- `components/` — React components and UI library
- `lib/` — Core utilities (AI, GitHub integration, Supabase, etc.)
- `types/` — TypeScript type definitions
- `public/` — Static assets
- `supabase/` — Supabase migrations and configuration

## Commands

Run commands from the project root:

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint (eslint-config-next with core-web-vitals + typescript)
```

## Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `GEMINI_API_KEY` — Google Gemini API key (used server-side for all AI analysis)
- `GITHUB_TOKEN` — Optional; increases GitHub API rate limit from 60 to 5000 req/hr

## Architecture

### App Router Layout (Next.js 16, React 19)

- `app/layout.tsx` — Root layout (fonts: Space Grotesk, Inter, Geist Mono)
- `app/(main)/layout.tsx` — Main layout with Navbar + Footer, wraps all authenticated/main pages
- `app/(auth)/` — Auth routes (login page, OAuth callback)
- `app/(main)/` — All feature pages: connect, configure, processing, analyze, learn, exercises, results, dashboard, history

### User Flow

1. **Connect** (`/connect`) — Paste GitHub URL or sign in to browse repos
2. **Configure** (`/configure`) — Preview file tree, select files, choose skill level
3. **Processing** (`/processing`) — SSE-streamed pipeline: fetch files → analyze tech stack → architecture → key files → summary → learning path → exercises
4. **Results** (`/results`) — View analysis, learning path, and exercises
5. **Dashboard** (`/dashboard`) — Protected route; lists saved projects (requires auth)

### AI Layer (`lib/ai/`)

- `provider.ts` — `AIProvider` interface with `generate()` and `generateStream()` methods
- `gemini.ts` — `GeminiProvider` implementation using `@google/genai`. Uses `gemini-2.0-flash` (fast) for analysis steps and `gemini-2.5-flash` (deep) for learning paths and exercises. Includes `GeminiSchemas` with structured output schemas for all response types.
- `prompts.ts` — All AI prompts (`PROMPTS` object): tech stack analysis, architecture analysis, code quality, key files, summary, quiz generation, learning path generation, exercise generation, and exercise evaluation. Each prompt function takes typed inputs and returns a formatted string.

### GitHub Integration (`lib/github/`)

- `parser.ts` — Parses GitHub URLs (full URLs, short form `owner/repo`)
- `fetcher.ts` — Fetches repo trees and file contents via Octokit. Handles auth fallback (if token fails, retries unauthenticated). Uses `p-limit` for concurrency control (5 concurrent requests).
- `filter.ts` — Filters files to source code only using extension/directory allowlists from `lib/constants.ts`
- `client.ts` — Fetches authenticated user's repos list

### Data Layer

**Dual storage strategy:**
- **localStorage** (`lib/project-sessions.ts`) — Stores `ProjectSession` objects for anonymous/unauthenticated users. Contains full analysis results, learning paths, and exercises.
- **Supabase** (`lib/supabase/db.ts`) — For authenticated users. Tables: `profiles`, `projects`, `project_files`, `analysis_results`, `assessments`, `learning_paths`, `learning_progress`, `exercises`, `exercise_attempts`.

Supabase client setup:
- `lib/supabase/client.ts` — Browser client (falls back to placeholder if env vars missing)
- `lib/supabase/server.ts` — Server client using cookie-based auth
- `lib/supabase/middleware.ts` — Session refresh middleware; only `/dashboard` is protected

### API Routes (`app/api/`)

All API routes are POST endpoints returning either JSON or SSE streams:
- `/api/process` — Main pipeline: fetches files + runs all AI analysis steps, returns SSE stream
- `/api/analyze` — Standalone analysis endpoint (SSE stream)
- `/api/github/repos` — List user's GitHub repos (requires auth)
- `/api/github/tree` — Fetch repo file tree metadata
- `/api/github/fetch` — Fetch file contents for selected files
- `/api/assess/questions` — Generate quiz questions
- `/api/assess/evaluate` — Evaluate quiz answers
- `/api/learn/generate` — Generate learning path
- `/api/exercises/generate` — Generate exercises
- `/api/exercises/evaluate` — Evaluate exercise answers
- `/api/projects/*` — CRUD for saved projects (save, list, check-duplicate, delete)
- `/api/upload` — File upload handler

### Types (`types/`)

- `github.ts` — `RepoFile`, `GitHubRepo`, `ParsedGitHubUrl`, `FetchRepoResult`, `TreePreviewFile`
- `analysis.ts` — `AnalysisResult` (techStack, architecture, codeQuality, keyFiles, summary)
- `learning.ts` — `LearningPath`, modules, lessons, resources
- `exercise.ts` — `Exercise` with types: `error_injection`, `code_recreation`, `code_explanation`, `mcq`, `output_prediction`, `parsons`, `error_message`
- `database.ts` — Supabase row types and `Database` type for typed client
- `project-session.ts` — `ProjectSession` for localStorage persistence
- `assessment.ts` — Quiz/assessment types

### UI

- **Component library** in `components/ui/` — Custom components (Button, Card, Input, etc.) using `clsx` + `tailwind-merge` for class merging
- **Styling** — Tailwind CSS v4 via `@tailwindcss/postcss`. Neo-brutalist design with `border-3`, `shadow-[Xpx_Xpx_0px_0px_#1A1A1A]`, and `rounded-[4px]` patterns.
- **Icons** — `lucide-react`
- **Code display** — `react-syntax-highlighter` and `@uiw/react-codemirror` with language extensions

### Path Aliases

`@/*` maps to the project root (configured in `tsconfig.json`).

## MCP Integration

The root `.mcp.json` configures the Supabase MCP server for database operations via Claude Code.
