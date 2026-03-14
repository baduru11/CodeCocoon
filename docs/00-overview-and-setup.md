# CodeCocoon — Project Overview & Setup

## What is CodeCocoon?

CodeCocoon is a **Next.js 16 web application** that analyzes GitHub repositories (or uploaded local code) using Google Gemini AI to generate:
- A beginner-friendly **tutorial** explaining the codebase with chapters, diagrams, and analogies
- A **personalized learning path** based on the user's role (Frontend, Backend, Fullstack, DevOps, PM, QA) and skill level
- **Interactive exercises** (7 types) drawn directly from the user's own code
- A **skill assessment quiz** to measure the user's current knowledge level

The tagline is: *"You built it with AI. Now understand what's inside."*

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router) |
| UI Library | React 19.2.3 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| AI | Google Gemini via `@google/genai@1.41.0` |
| Auth + DB | Supabase (`@supabase/ssr@0.8.0`, `@supabase/supabase-js@2.95.3`) |
| GitHub API | Octokit (`octokit@5.0.5`) |
| Concurrency | `p-limit@7.3.0` |
| Diagrams | `mermaid@11.12.2`, `dagre@0.8.5` |
| Markdown | `react-markdown@10.1.0`, `remark-gfm@4.0.1` |
| Code Editors | `@uiw/react-codemirror@4.25.4` |
| Code Highlighting | `react-syntax-highlighter@16.1.0` |
| YAML parsing | `js-yaml@4.1.1` |
| Class utilities | `clsx@2.1.1`, `tailwind-merge@3.4.0` |
| Icons | `lucide-react@0.564.0` |

---

## Environment Variables (`.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
GITHUB_TOKEN=ghp_your-github-pat  # optional, raises rate limit to 5000/hr
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Project Creation Commands

```bash
npx create-next-app@latest codecocoon --typescript --tailwind --app --src-dir=false
cd codecocoon

# Install all dependencies
npm install @google/genai @supabase/ssr @supabase/supabase-js octokit p-limit \
  mermaid dagre react-markdown remark-gfm react-syntax-highlighter \
  @uiw/react-codemirror @codemirror/lang-javascript @codemirror/lang-css \
  @codemirror/lang-json @codemirror/lang-python @codemirror/theme-one-dark \
  clsx tailwind-merge lucide-react js-yaml

npm install -D @types/dagre @types/js-yaml @types/react-syntax-highlighter \
  @types/node @tailwindcss/postcss
```

---

## Dev Commands

```bash
npm run dev    # Dev server at http://localhost:3000
npm run build  # Production build
npm run lint   # ESLint (core-web-vitals + typescript)
```

---

## Key Design Decisions

### 1. Neo-Brutalist Design System
The UI follows neo-brutalism: heavy `border-2` borders, `shadow-[3px_3px_0px_0px_#1E293B]` offset shadows, and a shift effect on hover (`translate-x-[2px] translate-y-[2px]` + shadow removed). All interactive elements use this pattern.

### 2. Dual Storage Architecture
- **Anonymous users**: Data stored in `localStorage` as `ProjectSession` objects
- **Authenticated users**: Data saved to Supabase PostgreSQL tables
- Both paths converge at the same results/exercises views

### 3. AI Rate Limiting
A global serial queue in `lib/ai/gemini.ts` ensures only 1 Gemini request fires at a time with a 7-second gap between starts (~8.5 RPM, safely under the 10 RPM free-tier limit for `gemini-2.5-flash`).

### 4. SSE Streaming
The main processing pipeline at `POST /api/process` streams incremental results back to the client via Server-Sent Events (SSE). Each pipeline step emits typed events that the `useProcessing` hook assembles into progressive state.

### 5. Two Gemini Models
- `gemini-2.5-flash-lite` — "fast" model for analysis steps (tech stack, architecture, key files)
- `gemini-2.5-flash` — "deep" model for tutorial chapters, lesson content, and exercises

---

## Supabase Setup

### Auth Provider
Enable **GitHub OAuth** in Supabase Dashboard:
- Scopes required: `public_repo read:user`
- Callback URL: `https://your-project.supabase.co/auth/v1/callback`
- Add `http://localhost:3000/auth/callback` to allowed redirect URLs

### Required Database Tables
See `13-database-schema.md` for the complete SQL schema.

### Row Level Security (RLS)
All tables have RLS enabled. Users can only access/modify their own data. The `projects` table's cascade-delete handles cleanup of related rows.

---

## App Architecture

```
User opens app
    │
    ▼
Home (/) → Connect (/connect) → Configure (/configure) → Processing (/processing)
                                                                │
                                                    POST /api/process (SSE)
                                                                │
                                                         Results (/results)
                                                        ┌───────┼────────┐
                                                     Tutorial  Learn  Exercises
```

### Route Groups
- `app/(auth)/` — Login + OAuth callback (no navbar)
- `app/(main)/` — All feature pages (has navbar + footer)
- `app/api/` — Backend API routes

### Path Alias
`@/*` maps to the project root. Use `@/lib/utils`, `@/types/github`, etc.
