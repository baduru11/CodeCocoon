# CodeCocoon — Reconstruction Guide

Step-by-step instructions to recreate the exact project from scratch using Claude Code CLI.

---

## Prerequisites

- Node.js 20+
- npm 10+
- Supabase account
- Google Gemini API key
- GitHub OAuth App (for auth)
- Claude Code CLI

---

## Phase 1: Project Scaffold

### Step 1: Create Next.js App

```bash
npx create-next-app@latest codecocoon \
  --typescript \
  --tailwind \
  --app \
  --src-dir=false \
  --import-alias="@/*" \
  --no-eslint
cd codecocoon
```

### Step 2: Install All Dependencies

```bash
# Core
npm install @google/genai @supabase/supabase-js @supabase/ssr octokit p-limit js-yaml

# UI
npm install lucide-react clsx tailwind-merge react-markdown remark-gfm
npm install react-syntax-highlighter @uiw/react-codemirror mermaid

# Graph layout
npm install dagre

# Fonts
npm install geist

# Types
npm install -D @types/js-yaml @types/dagre @types/react-syntax-highlighter
```

### Step 3: Configure `tsconfig.json`

Replace generated tsconfig with:
```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Step 4: Create `next.config.ts`

```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

### Step 5: Set Up Env

Create `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
GEMINI_API_KEY=your-gemini-api-key
GITHUB_TOKEN=optional-github-token
```

---

## Phase 2: TypeScript Types

Create all files in `types/`. Use the exact code from `docs/02-types.md`.

```
types/
├── github.ts       → GitHubRepo, RepoFile, TreePreviewFile, FetchTreeResult, ProcessConfig, FilterReason
├── analysis.ts     → TechStack, ArchitectureInfo, KeyFile, AnalysisResult, AnalysisStreamEvent (17 event types)
├── learning.ts     → RoleProfile, RolePreset, SkillNode, SkillEdge, SkillModule, LearningPathV2, isV2LearningPath
├── exercise.ts     → ExerciseType (7 types), Exercise, ExerciseAttempt
├── assessment.ts   → QuizQuestion, QuizAnswer, AssessmentResult
├── tutorial.ts     → TutorialAbstraction, TutorialRelationships, TutorialChapter, TutorialData
├── project-session.ts → ProjectSession
└── database.ts     → Database union type, all row types
```

---

## Phase 3: Lib Layer

### Constants and Utils

```
lib/
├── constants.ts      → SOURCE_EXTENSIONS, CONFIG_FILES, IGNORED_DIRS, BINARY_EXTENSIONS,
│                        SKILL_LEVELS, SKILL_LEVEL_OPTIONS, GEMINI_MODELS, EXERCISE_TYPES,
│                        PROCESSING_STEPS (13 steps), FILE_SIZE_WARNING_BYTES, limits
├── utils.ts          → cn(), formatDate, truncate, getLanguageFromExtension,
│                        getFileExtension, bytesToSize, normalizeCode
└── project-sessions.ts → Full localStorage CRUD (getAllSessions, getSession, saveSession,
                           deleteSession, getActiveSessionId, setActiveSessionId,
                           getActiveSession, updateSessionExercises, getFavoriteIds, toggleFavorite)
```

See `docs/03-lib-constants-utils-sessions.md` for exact code.

### AI Layer

```
lib/ai/
├── provider.ts           → AIProvider interface, GenerateOptions, GenerateResult, StreamChunk
├── gemini.ts             → GeminiProvider class + RequestQueue rate limiter (1 concurrent, 7s gap)
│                           + GeminiSchemas (8 structured output schemas)
├── prompts.ts            → PROMPTS object with all 15 prompt functions
│                           + formatFilesStructureOnly, formatFilesTruncated, formatFilesWithIndices
├── yaml-parser.ts        → extractYaml<T>(), parseIndex()
├── tutorial-pipeline.ts  → runTutorialPipeline() — 4 steps (abstractions → relationships → order → chapters)
└── learning-pipeline.ts  → runLearningPipeline() — 4 steps (concepts → graph → lessons → resources)
                            + assembleSkillTree() + MODULE_COLORS
```

See `docs/04-lib-ai.md` for exact code.

### GitHub Layer

```
lib/github/
├── parser.ts   → parseGitHubUrl(), buildGitHubUrl(), isValidGitHubInput(), isValidGitHubName()
├── filter.ts   → filterSourceFilesWithMetadata(), filterSourceFiles(), getLanguageStats()
├── fetcher.ts  → fetchRepoFiles(), fetchRepoTree(), fetchContentForFiles(), isRateLimitError()
└── client.ts   → fetchUserRepos() (paginated, max 500)
```

### Supabase Layer

```
lib/supabase/
├── client.ts     → createClient() for browser (with placeholder fallback)
├── server.ts     → createClient() for server (with cookie store)
├── middleware.ts → updateSession() protecting /dashboard
└── db.ts         → saveProject, updateProjectStatus, saveProjectFiles, saveAnalysisResult,
                    saveLearningPath (V1+V2), saveExercises, getUserProjects,
                    findDuplicateProject, getProjectWithAllData, dbRowToExercise, dbRowToAnalysis
```

See `docs/05-lib-github-supabase.md` for exact code.

---

## Phase 4: Global CSS

Replace `app/globals.css` with the full content from `docs/10-design-system.md`.

Key points:
- Uses `@theme inline` (Tailwind v4 syntax) for CSS variables
- Defines neo-brutalist shadow variables
- `.animate-fade-in` uses `--delay` CSS custom property for stagger
- `.dot-grid`, `.progress-stripes`, `.brutal-*` utility classes
- Fonts referenced via `--font-*` CSS variables

---

## Phase 5: UI Components

Create all files in `components/ui/`. See `docs/08-ui-components.md` for exact code.

```
components/ui/
├── button.tsx    → 5 variants (default/secondary/outline/ghost/destructive), 4 sizes, loading state
├── card.tsx      → Card + CardHeader + CardTitle + CardDescription + CardContent + CardFooter
├── badge.tsx     → 7 color variants
├── progress.tsx  → progress-stripes animated bar
├── input.tsx     → styled text input
├── textarea.tsx  → resizable textarea
├── skeleton.tsx  → animate-pulse loading skeleton
├── code-block.tsx → react-syntax-highlighter wrapper (oneDark theme)
├── select.tsx    → custom styled select
├── dialog.tsx    → backdrop modal
└── tabs.tsx      → generic tab container
```

---

## Phase 6: Layout Components

```
components/layout/
├── navbar.tsx      → sticky, backdrop-blur, mobile menu, active link, auth button
├── auth-button.tsx → GitHub OAuth login/logout, user state via supabase
└── footer.tsx      → logo, nav links, copyright, GitHub link
```

```
components/landing/
├── hero.tsx        → dot-grid bg, staggered animations, terminal mockup
├── how-it-works.tsx → 3-step section
└── features.tsx    → 6-feature grid with accent borders
```

---

## Phase 7: Hooks

Create all files in `hooks/`. See `docs/07-hooks.md` for exact code.

```
hooks/
├── use-processing.ts        → SSE stream parser, step state machine, ProcessingResults
├── use-auth.ts              → Supabase auth state with onAuthStateChange
├── use-local-storage.ts     → Generic typed localStorage with SSR safety
├── use-project-sessions.ts  → Reactive wrapper around lib/project-sessions.ts
├── use-analysis.ts          → Read analysis from active session
└── use-scrollspy.ts         → IntersectionObserver for active section tracking
```

---

## Phase 8: API Routes

Create all files in `app/api/`. See `docs/06-api-routes.md` for exact code.

**Build order** (each depends on previous):

1. `app/api/github/tree/route.ts` — fetch repo file tree
2. `app/api/github/fetch/route.ts` — fetch repo file contents
3. `app/api/github/repos/route.ts` — list user repos
4. `app/api/upload/route.ts` — multipart file upload
5. `app/api/exercises/evaluate/route.ts` — AI exercise evaluation
6. `app/api/exercises/generate/route.ts` — standalone exercise generation
7. `app/api/assess/questions/route.ts` — generate quiz questions
8. `app/api/assess/evaluate/route.ts` — score quiz answers
9. `app/api/projects/save/route.ts` — save to Supabase
10. `app/api/projects/list/route.ts` — list saved projects
11. `app/api/projects/check-duplicate/route.ts` — check if repo already saved
12. `app/api/projects/[id]/route.ts` — GET + DELETE single project
13. `app/api/learn/generate/route.ts` — standalone learning path
14. **`app/api/process/route.ts`** ← most complex, depends on all lib/ai/* functions

### `app/api/process/route.ts` Key Implementation

```typescript
// SSE streaming with ReadableStream
export async function POST(req: Request) {
  const body = await req.json();

  let aborted = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, data: unknown) => {
        const line = `data: ${JSON.stringify({ type, data })}\n\n`;
        controller.enqueue(new TextEncoder().encode(line));
      };

      const checkAborted = () => {
        if (aborted) throw new Error("Client disconnected");
      };

      try {
        // 1. Get Supabase session for GitHub token
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.provider_token || process.env.GITHUB_TOKEN || "";

        // 2. Fetch files (or use uploadedFiles)
        let projectData: FetchRepoResult;
        if (body.uploadedFiles) {
          const selected = new Set(body.selectedFiles.map((f: any) => f.path));
          projectData = { files: body.uploadedFiles.filter((f: any) => selected.has(f.path)), ... };
        } else {
          projectData = await fetchContentForFiles(body.owner, body.repo, body.selectedFiles, { token });
        }
        send("files_fetched", projectData);

        // 3. Analysis (parallel-ish, but rate-limited serial)
        const [techStack, architecture, keyFiles] = await Promise.all([
          /* analyzeTechStack, analyzeArchitecture, identifyKeyFiles */
        ]);
        send("tech_stack", techStack);
        send("architecture", architecture);
        send("key_files", keyFiles);

        // 4. Tutorial pipeline (sequential chapters)
        const tutorialData = await runTutorialPipeline(ai, projectData.files, body.repo, send, checkAborted);

        // 5. Learning pipeline
        const role = resolveRole(body.role);
        const learningPath = await runLearningPipeline(ai, { role, skillLevel: body.skillLevel, ... }, send, checkAborted);

        // 6. Exercises
        const exercises = await generateExercises(ai, projectData.files, body.skillLevel);
        send("exercises", exercises);

        // 7. Complete
        send("complete", { projectData, analysis: { techStack, architecture, keyFiles, summary, tutorialData }, learningPath, exercises });
        controller.close();
      } catch (err) {
        send("error", { message: err.message });
        controller.close();
      }
    },
    cancel() { aborted = true; }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

---

## Phase 9: Auth Route

```
app/(auth)/
├── layout.tsx
├── login/page.tsx
└── auth/callback/route.ts   ← OAuth callback handler
```

See `docs/06-api-routes.md` for the callback route code.

---

## Phase 10: App Pages

Create all pages. See `docs/09-pages.md` for complete code.

**Build order**:

1. `app/layout.tsx` — root layout (fonts, Navbar, Footer)
2. `app/(main)/page.tsx` — landing page
3. `app/(main)/connect/page.tsx` — URL input + upload
4. `app/(main)/configure/page.tsx` — file + skill selection
5. `app/(main)/processing/page.tsx` — SSE progress display
6. `app/(main)/results/page.tsx` — main learning interface

Then secondary pages:
7. `app/(main)/assess/page.tsx`
8. `app/(main)/dashboard/page.tsx`
9. `app/(main)/history/page.tsx`
10. `app/(main)/upload/page.tsx`
11. `app/(main)/exercises/page.tsx` — redirect to /results
12. `app/(main)/learn/page.tsx` — redirect to /results
13. `app/(main)/analyze/page.tsx` — redirect to /results

---

## Phase 11: Results Components

```
components/results/
├── mermaid-diagram.tsx    → dynamic import Mermaid, sanitizeChart(), error fallback
├── section-tabs.tsx       → Tutorial/Learn/Exercises tab bar
├── tutorial-overview.tsx  → Chapter card grid
├── tutorial-chapter.tsx   → react-markdown + mermaid code block renderer
├── learning-path-tab.tsx  → V2LearningPathView + V1LearningPathView dispatcher
├── skill-tree.tsx         → Dagre graph, SVG render, foreignObject nodes
├── learning-dashboard.tsx → Role/progress/gap analysis/module grid
├── concept-detail-panel.tsx → Inline lesson detail panel
├── linear-path-view.tsx   → Mobile node list
├── exercises-tab.tsx      → Full exercise interface with score screen
├── resource-card.tsx      → External learning resource card
└── progress-ring.tsx      → SVG circular progress
```

---

## Phase 12: Exercise Components

```
components/exercises/
├── mcq-exercise.tsx          → MCQ with 3-step answer resolution
├── fill-blank-exercise.tsx   → ___BLANK_N___ placeholder parsing
├── parsons-exercise.tsx      → Drag-to-reorder code lines
├── text-exercise.tsx         → Free-text answer + AI evaluation
└── error-message-exercise.tsx → Error message identification
```

---

## Phase 13: Supabase Setup

### Database Migration

Run the SQL from `docs/11-database-schema.md` in Supabase SQL Editor:
1. Create all tables with correct columns
2. Add indexes
3. Enable RLS on all tables
4. Create policies

### Auth Configuration

In Supabase Dashboard:
1. Authentication → Providers → Enable GitHub
2. Enter GitHub OAuth App Client ID + Secret
3. Add redirect URL: `https://your-domain.com/auth/callback`

### GitHub OAuth App Setup

In GitHub Settings → Developer settings → OAuth Apps:
1. Create new OAuth App
2. Homepage URL: your domain
3. Authorization callback URL: `https://your-domain.com/auth/callback`
4. Copy Client ID and Secret to Supabase

---

## Phase 14: Middleware

Create `middleware.ts` at project root:
```typescript
import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

---

## Phase 15: MCP Config (Optional)

Create `.mcp.json` at project root for Supabase MCP server:
```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server-supabase@latest", "--access-token", "<TOKEN>"]
    }
  }
}
```

---

## Verification Checklist

After completing all phases, verify:

- [ ] `npm run build` succeeds (no TypeScript errors)
- [ ] Landing page loads at `localhost:3000`
- [ ] `/connect` page loads, URL input works
- [ ] Pasting a GitHub URL → navigates to `/configure`
- [ ] `/configure` shows files and skill level selector
- [ ] Starting analysis → `/processing` SSE stream shows steps
- [ ] Processing completes → `/results` shows tutorial + learn + exercises tabs
- [ ] Auth: "Login with GitHub" button → OAuth flow → redirects back
- [ ] Dashboard visible when authenticated
- [ ] History page shows localStorage sessions
- [ ] Upload: drag-and-drop files + folder upload works
- [ ] Exercises: MCQ, fill-blank, parsons all render correctly
- [ ] Mermaid diagrams render in tutorial chapters

---

## Common Pitfalls

### Tailwind v4 Setup
Use `@import "tailwindcss"` (not `@tailwind base/components/utilities`). CSS variables are defined with `@theme inline {}` block.

### SSE Streaming
The `ReadableStream` API requires no `Content-Length` header and `Connection: keep-alive`. Never buffer the entire response.

### Gemini Rate Limiting
The global `RequestQueue` in `gemini.ts` is a singleton per server process. With 1 concurrent request and 7s gap, 8 AI calls take ~56 seconds minimum. This is intentional to stay under 10 RPM free tier.

### Upload Sentinel Value
When `treeData.owner === "__upload__"`, the configure page sets `isUpload: true` in ProcessConfig. The process route checks this to skip GitHub fetching.

### V2 Learning Path Type Guard
```typescript
// Always use isV2LearningPath() before accessing V2-specific fields
if (isV2LearningPath(path)) {
  // Safe to access path.nodes, path.edges, path.modules, path.gapAnalysis
}
```

### Mermaid Security Level
Mermaid must be initialized with `securityLevel: "loose"` to render. Without this, diagrams fail silently or show errors.

### normalizeCode Utility
AI-generated code often has double-escaped `\\n`. Always use `normalizeCode()` before rendering:
```typescript
import { normalizeCode } from "@/lib/utils";
<CodeBlock code={normalizeCode(exercise.originalCode)} />
```

### Dual Storage Pattern
Anonymous users get localStorage only. Authenticated users can optionally save to Supabase. Results page always reads from localStorage first (`useProjectSessions`), not Supabase.
