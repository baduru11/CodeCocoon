# CODECOCOON — PROJECT KNOWLEDGE BASE

**Stack**: Next.js 16.1.6 (App Router) + React 19 + Supabase + Google Gemini AI + Tailwind v4
**Purpose**: Platform where vibe coders enter a cocoon and emerge as real developers — connect GitHub repos, get AI-powered codebase analysis, personalized learning paths, and interactive exercises built from their own code.

## STRUCTURE

```
codecocoon/
├── app/
│   ├── (auth)/              # Auth routes (no navbar/footer)
│   │   ├── login/           # GitHub OAuth login
│   │   └── auth/callback/   # OAuth callback handler
│   ├── (main)/              # Public routes (navbar + footer layout)
│   │   ├── page.tsx         # Landing page (hero, features, how-it-works)
│   │   ├── connect/         # Paste GitHub URL or browse repos
│   │   ├── upload/          # Direct file upload (alt to GitHub)
│   │   ├── analyze/         # SSE streaming analysis results
│   │   ├── assess/          # Adaptive skill assessment quiz
│   │   ├── learn/           # AI-generated learning paths
│   │   ├── exercises/       # Interactive exercises from user's code
│   │   └── dashboard/       # Protected — requires auth
│   ├── api/                 # 8 API endpoints (see WHERE TO LOOK)
│   ├── globals.css          # Design system (@theme inline)
│   └── layout.tsx           # Root layout (fonts, metadata)
├── components/
│   ├── ui/                  # 11 primitives (button, card, input, dialog, tabs, etc.)
│   ├── layout/              # navbar, footer, auth-button
│   └── landing/             # hero, features, how-it-works
├── lib/
│   ├── ai/                  # AI provider abstraction + Gemini impl
│   ├── github/              # GitHub API (fetcher, parser, filter, client)
│   ├── supabase/            # Supabase clients (browser, server, middleware)
│   ├── constants.ts         # Limits, models, file extensions
│   └── utils.ts             # cn(), formatDate, getLanguageFromExtension
├── hooks/                   # useAuth, useAnalysis (SSE), useLocalStorage
├── types/                   # 6 type files (github, analysis, assessment, learning, exercise, database)
├── proxy.ts                 # Next.js 16 middleware (NOT misnamed — see NOTES)
└── supabase/migrations/     # SQL schema (9 tables with RLS)
```

## WHERE TO LOOK

| Task | Files | Notes |
|------|-------|-------|
| Add new AI feature | `lib/ai/prompts.ts`, `lib/ai/gemini.ts` (schemas) | Add prompt fn + schema, then create API route |
| Swap AI provider | `lib/ai/provider.ts` (interface), create new impl | Factory pattern ready, just implement `AIProvider` |
| Fix GitHub fetching | `lib/github/fetcher.ts` | Has auth retry fallback (401/403 → unauthenticated) |
| Parse GitHub URLs | `lib/github/parser.ts` | Regex supports full URL, .git suffix, `owner/repo` shorthand |
| Change file filters | `lib/github/filter.ts`, `lib/constants.ts` | SOURCE_EXTENSIONS, IGNORED_DIRS, CONFIG_FILES lists |
| Modify auth flow | `lib/supabase/middleware.ts`, `proxy.ts` | Only `/dashboard` is protected; add paths at line 38 |
| Add new page | `app/(main)/newpage/page.tsx` | Auto-gets navbar/footer from `(main)/layout.tsx` |
| Add API endpoint | `app/api/domain/route.ts` | POST with try-catch, return NextResponse.json |
| Streaming endpoint | `app/api/analyze/route.ts` | Reference for SSE pattern (ReadableStream + text/event-stream) |
| New UI component | `components/ui/` | Follow variant pattern from `button.tsx`, use `cn()` |
| Design tokens | `app/globals.css` | `@theme inline` block — all colors, shadows, fonts |
| Modify limits | `lib/constants.ts` | MAX_FILES=100, MAX_FILE_SIZE=100KB, MAX_TOTAL=500KB, CONCURRENCY=5 |
| Database schema | `supabase/migrations/001_initial_schema.sql` | 9 tables, RLS policies, NOT yet wired to app |

## CONVENTIONS

**Imports**: Always `@/` prefix (alias to root). Never relative `../`.
**Styling**: Tailwind v4 with `cn()` (clsx + tailwind-merge). Never inline style objects.
**Components**: `"use client"` directive on interactive components. `forwardRef` for native element wrappers. Variant props via conditional `cn()` classes.
**API Routes**: POST handlers. Try-catch wrapping. Return `NextResponse.json({ error }, { status })` on failure. Log with `console.error`.
**Hooks**: `"use client"` directive. `use-` prefix kebab-case filenames. Error-tolerant (try-catch with console.warn).
**Types**: Dedicated files in `types/` dir. Exported interfaces, not type aliases.
**Constants**: UPPER_SNAKE_CASE in `lib/constants.ts`. Never magic numbers in service code.
**Files**: kebab-case filenames. PascalCase components. camelCase functions/variables.

### Neo-Brutalism Design System

- **Borders**: `border-3 border-foreground` (3px solid black)
- **Shadows**: `shadow-[Npx_Npx_0px_0px_#1A1A1A]` where N = 3, 5, 8, or 12
- **Radius**: `rounded-[4px]` (sharp, not rounded)
- **Hover**: `hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none` (pressed effect)
- **Colors**: Primary `#FF6B6B`, Secondary `#5294FF`, Background `#F5F0EB`, Foreground `#1A1A1A`
- **Accents**: Yellow `#FACC15`, Green `#05E17A`, Purple `#A855F7`, Orange `#FF7A05`, Pink `#FF85B2`
- **Fonts**: Space Grotesk (headings, 700), Inter (body, 500), Geist Mono (code)
- **Utility classes**: `.brutal-border`, `.brutal-shadow`, `.brutal-shadow-sm/lg/xl`, `.brutal-hover`

### AI Service Architecture

- `AIProvider` interface in `lib/ai/provider.ts` — `generate()` and `generateStream()` methods
- `GeminiProvider` in `lib/ai/gemini.ts` — uses `@google/genai` SDK (NOT the deprecated `@google/generative-ai`)
- `GeminiSchemas` — JSON schemas for structured output (techStack, architecture, codeQuality, quizQuestions, learningPath, exercises)
- Models: `gemini-2.0-flash` (fast/cheap), `gemini-2.5-flash` (deep/complex) — defined in `GEMINI_MODELS` constant
- All prompt templates in `lib/ai/prompts.ts` — each returns `{ role: "user", content: string }`

### GitHub Service Architecture

- `fetchRepoFiles()` — main entry. Creates Octokit, fetches tree, filters, batch-fetches content with `p-limit(5)`
- Auth fallback: if token causes 401/403, retries entire fetch with unauthenticated client
- `parseGitHubUrl()` — regex parser, returns `{ owner, repo }` or null
- `filterSourceFiles()` — whitelist extensions, skip node_modules/binaries, always include config files

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** pass empty/invalid token to Octokit `auth` — it sends bad Authorization header. Use `createOctokit("")` helper.
- **NEVER** trust Supabase placeholder fallback — `lib/supabase/client.ts` and `server.ts` silently create broken clients when env vars missing. Check for `"placeholder"` in URL.
- **NEVER** JSON.parse Gemini responses without try-catch — AI can return malformed JSON. Routes at `app/api/analyze/route.ts`, `learn/generate`, `exercises/generate` currently lack this.
- **NEVER** assume route protection — only `/dashboard` is guarded in middleware. All other pages rely on client-side redirects.
- **Data persistence is localStorage only** — no Supabase DB wiring yet. `useLocalStorage` hook stores projectData, analysisData, assessmentData, learningPath between page navigations.

## COMMANDS

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build (verify: 21 routes, 0 errors)
npm run lint         # ESLint
npm run start        # Production server
```

## NOTES

- **proxy.ts is correct for Next.js 16** — Next.js 16 renamed `middleware.ts` → `proxy.ts` and `middleware()` → `proxy()`. This is NOT a bug. Do NOT rename it back.
- **Empty artifact directories at root** — ~25 directories like `appapianalyze/`, `componentsui/`, `libai/` etc. are empty scaffolding leftovers. Safe to delete. They don't affect the build.
- **SSE streaming pattern** — `/api/analyze` streams 5 analysis stages via Server-Sent Events. Client uses `useAnalysis` hook with `ReadableStream` reader. Format: `data: ${JSON.stringify({ type, data })}\n\n`.
- **Navigation flow**: connect/upload → analyze → assess → learn → exercises. Each page checks localStorage for required data and redirects to /connect if missing.
- **Multi-provider ready** — `AIProvider` interface exists but only `GeminiProvider` is implemented. Adding Claude/OpenAI requires new class + import swap in API routes.

## ENV VARS

```
NEXT_PUBLIC_SUPABASE_URL=         # Required for auth
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Required for auth
GEMINI_API_KEY=                   # Required — hard error if missing
GITHUB_TOKEN=                     # Optional — higher rate limits (5000 vs 60 req/hr)
```
