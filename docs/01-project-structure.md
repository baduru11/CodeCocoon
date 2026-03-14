# CodeCocoon — Complete Project Structure

## Directory Tree

```
codecocoon/
├── app/
│   ├── globals.css                    # Tailwind v4 + neo-brutalist design tokens + animations
│   ├── layout.tsx                     # Root HTML with 3 Google Fonts
│   ├── error.tsx                      # Global error boundary (client)
│   ├── loading.tsx                    # Global loading spinner
│   ├── not-found.tsx                  # 404 page
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx             # GitHub OAuth login page
│   │   └── auth/callback/route.ts     # OAuth callback handler (code exchange)
│   │
│   ├── (main)/
│   │   ├── layout.tsx                 # Navbar + main + Footer wrapper
│   │   ├── page.tsx                   # Home: Hero + HowItWorks + Features
│   │   ├── connect/page.tsx           # Step 1: Enter GitHub URL / pick repo / upload files
│   │   ├── configure/page.tsx         # Step 2: Skill level + role + file selection
│   │   ├── processing/page.tsx        # Step 3: SSE progress display (auto-starts)
│   │   ├── results/page.tsx           # Step 4: Tutorial | Learn | Exercises tabs
│   │   ├── assess/page.tsx            # Optional: Quiz-based skill assessment
│   │   ├── dashboard/page.tsx         # Auth-only: Saved projects grid
│   │   ├── history/page.tsx           # localStorage: All analyzed projects
│   │   ├── upload/page.tsx            # Alternative: Dedicated file upload entry
│   │   ├── analyze/page.tsx           # (Redirects to /connect)
│   │   ├── learn/page.tsx             # (Redirects to /results)
│   │   └── exercises/page.tsx         # (Redirects to /results)
│   │
│   └── api/
│       ├── process/route.ts           # ★ MAIN PIPELINE — POST (SSE stream)
│       ├── upload/route.ts            # POST multipart file upload
│       ├── analyze/route.ts           # POST legacy analysis (standalone)
│       ├── github/
│       │   ├── tree/route.ts          # POST fetch repo tree metadata
│       │   ├── fetch/route.ts         # POST fetch repo file contents
│       │   └── repos/route.ts         # GET authenticated user's repos
│       ├── projects/
│       │   ├── save/route.ts          # POST save project to Supabase
│       │   ├── list/route.ts          # GET list user's saved projects
│       │   ├── check-duplicate/route.ts  # POST check if repo already saved
│       │   └── [id]/route.ts          # GET project details | DELETE project
│       ├── exercises/
│       │   ├── generate/route.ts      # POST generate exercises (standalone)
│       │   └── evaluate/route.ts      # POST evaluate user's exercise answer
│       ├── assess/
│       │   ├── questions/route.ts     # POST generate quiz questions
│       │   └── evaluate/route.ts      # POST score quiz answers
│       └── learn/
│           └── generate/route.ts      # POST generate learning path (standalone)
│
├── components/
│   ├── ui/
│   │   ├── button.tsx                 # Neo-brutalist button (5 variants, 4 sizes)
│   │   ├── card.tsx                   # Card + CardHeader/Title/Description/Content/Footer
│   │   ├── badge.tsx                  # Badge (7 color variants)
│   │   ├── input.tsx                  # Text input with neo-brutalist border
│   │   ├── textarea.tsx               # Textarea with neo-brutalist border
│   │   ├── tabs.tsx                   # Tab navigation component
│   │   ├── progress.tsx               # Progress bar with label + color prop
│   │   ├── dialog.tsx                 # Modal dialog
│   │   ├── select.tsx                 # Dropdown selector
│   │   ├── skeleton.tsx               # Loading skeleton placeholder
│   │   └── code-block.tsx             # Syntax-highlighted code block
│   │
│   ├── landing/
│   │   ├── hero.tsx                   # Hero section with CTA
│   │   ├── how-it-works.tsx           # 3-step process explanation
│   │   └── features.tsx               # Feature cards grid
│   │
│   ├── layout/
│   │   ├── navbar.tsx                 # Navigation bar with auth state
│   │   ├── footer.tsx                 # Footer with links
│   │   └── auth-button.tsx            # Login/user dropdown button
│   │
│   ├── results/
│   │   ├── section-tabs.tsx           # Summary | Learn | Exercises tab bar
│   │   ├── tutorial-overview.tsx      # Tutorial introduction + chapter cards
│   │   ├── tutorial-chapter.tsx       # Single chapter with markdown + diagrams
│   │   ├── mermaid-diagram.tsx        # Safe Mermaid diagram renderer
│   │   ├── learning-path-tab.tsx      # Learning path (dispatches to V1/V2 views)
│   │   ├── learning-dashboard.tsx     # V2 learning dashboard wrapper
│   │   ├── skill-tree.tsx             # Dagre-based skill dependency graph
│   │   ├── linear-path-view.tsx       # Sequential learning path list
│   │   ├── concept-detail-panel.tsx   # Side panel: node details + resources
│   │   ├── resource-card.tsx          # Single learning resource recommendation
│   │   ├── progress-ring.tsx          # Circular progress indicator (SVG)
│   │   └── exercises-tab.tsx          # Exercise list + submission + feedback
│   │
│   └── exercises/
│       ├── mcq-exercise.tsx           # Multiple choice (also output_prediction)
│       ├── fill-blank-exercise.tsx    # Fill-in-the-blank (code_recreation)
│       ├── error-message-exercise.tsx # Error interpretation (error_message)
│       ├── parsons-exercise.tsx       # Line reordering (parsons)
│       └── text-exercise.tsx          # Free text (error_injection, code_explanation)
│
├── hooks/
│   ├── use-processing.ts              # SSE stream parser + step state machine
│   ├── use-auth.ts                    # Supabase auth state (user, session, loading)
│   ├── use-local-storage.ts           # Generic typed localStorage hook
│   ├── use-project-sessions.ts        # CRUD for localStorage project sessions
│   ├── use-analysis.ts                # Load analysis data from active session
│   └── use-scrollspy.ts               # Track which section is in viewport
│
├── lib/
│   ├── constants.ts                   # File filters, skill levels, models, limits
│   ├── utils.ts                       # cn(), formatDate, truncate, normalizeCode, etc.
│   ├── project-sessions.ts            # localStorage CRUD for ProjectSession[]
│   │
│   ├── ai/
│   │   ├── provider.ts                # AIProvider interface + GenerateOptions types
│   │   ├── gemini.ts                  # GeminiProvider + RequestQueue + GeminiSchemas
│   │   ├── prompts.ts                 # All LLM prompts (PROMPTS object)
│   │   ├── tutorial-pipeline.ts       # 4-step tutorial generation
│   │   ├── learning-pipeline.ts       # 4-step V2 learning path generation
│   │   └── yaml-parser.ts             # extractYaml(), parseIndex()
│   │
│   ├── github/
│   │   ├── parser.ts                  # parseGitHubUrl, buildGitHubUrl, isValidGitHubName
│   │   ├── filter.ts                  # filterSourceFilesWithMetadata, getLanguageStats
│   │   ├── fetcher.ts                 # fetchRepoFiles, fetchRepoTree, fetchContentForFiles
│   │   └── client.ts                  # fetchUserRepos (authenticated)
│   │
│   └── supabase/
│       ├── client.ts                  # Browser Supabase client
│       ├── server.ts                  # Server Supabase client (cookie auth)
│       ├── middleware.ts              # updateSession() — protects /dashboard
│       └── db.ts                      # All DB operations (saveProject, getUserProjects, etc.)
│
├── types/
│   ├── github.ts                      # GitHubRepo, RepoFile, FetchTreeResult, ProcessConfig
│   ├── analysis.ts                    # TechStack, ArchitectureInfo, KeyFile, AnalysisResult
│   ├── learning.ts                    # RoleProfile, SkillNode, LearningPathV2, resources
│   ├── exercise.ts                    # Exercise, ExerciseType, ExerciseAttempt
│   ├── assessment.ts                  # QuizQuestion, AssessmentResult
│   ├── tutorial.ts                    # TutorialAbstraction, TutorialChapter, TutorialData
│   ├── project-session.ts             # ProjectSession (localStorage unit)
│   └── database.ts                    # Supabase table row types + Database union type
│
├── public/                            # Static assets (favicon, etc.)
├── package.json
├── tsconfig.json
├── next.config.ts
└── .env.local                         # Never commit — see above for required vars
```

---

## Configuration Files

### `package.json`
```json
{
  "name": "codecocoon",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint"
  },
  "dependencies": {
    "@codemirror/lang-css": "^6.3.1",
    "@codemirror/lang-javascript": "^6.2.4",
    "@codemirror/lang-json": "^6.0.2",
    "@codemirror/lang-python": "^6.2.1",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@google/genai": "^1.41.0",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.95.3",
    "@uiw/react-codemirror": "^4.25.4",
    "clsx": "^2.1.1",
    "dagre": "^0.8.5",
    "js-yaml": "^4.1.1",
    "lucide-react": "^0.564.0",
    "mermaid": "^11.12.2",
    "next": "16.1.6",
    "octokit": "^5.0.5",
    "p-limit": "^7.3.0",
    "react": "19.2.3",
    "react-dom": "19.2.3",
    "react-markdown": "^10.1.0",
    "react-syntax-highlighter": "^16.1.0",
    "remark-gfm": "^4.0.1",
    "tailwind-merge": "^3.4.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/dagre": "^0.7.53",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/react-syntax-highlighter": "^15.5.13",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### `tsconfig.json`
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
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### `next.config.ts`
```typescript
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

### `middleware.ts` (root level — Next.js routing middleware)
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
