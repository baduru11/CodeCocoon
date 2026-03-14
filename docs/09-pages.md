# CodeCocoon — App Pages

All pages in `app/(main)/`. All are client components unless noted.

---

## `app/(main)/page.tsx` — Landing Page (Server Component)

```typescript
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <HowItWorks />
      <Features />
    </main>
  );
}
```

---

## `app/(auth)/login/page.tsx` — Login Page (Server Component)

```typescript
import { AuthButton } from "@/components/layout/auth-button";
import { Github, BookOpen, GraduationCap, Zap, Star } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const benefits = [
  { icon: BookOpen, text: "Save your analyses and revisit anytime" },
  { icon: GraduationCap, text: "Track your learning progress" },
  { icon: Zap, text: "Higher GitHub rate limits for faster analysis" },
  { icon: Star, text: "Access your full dashboard" },
];

export default function LoginPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-yellow border-2 border-foreground rounded-xl shadow-[4px_4px_0px_0px_#1E293B] mb-6">
          <Github size={32} strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl font-bold mb-3">Login with GitHub</h1>
        <p className="text-muted font-medium text-lg">
          Connect your GitHub account to unlock the full CodeCocoon experience
        </p>
      </div>

      <div className="bg-surface border-2 border-foreground rounded-xl shadow-[4px_4px_0px_0px_#1E293B] p-6 mb-6">
        <h2 className="font-bold mb-4">Why sign in?</h2>
        <ul className="space-y-3">
          {benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center shrink-0">
                <Icon size={16} className="text-secondary" />
              </div>
              <span className="text-sm font-medium">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <AuthButton />
      <p className="text-center text-xs text-muted font-medium mt-6">
        No account needed for basic analysis — login is optional
      </p>
      <div className="text-center mt-4">
        <Link href="/connect">
          <Button variant="ghost" size="sm" className="gap-2">
            Continue without login
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

**Note**: `(searchParams)` prop checks for `?error=true` to show OAuth error message.

---

## `app/(main)/connect/page.tsx` — Connect Repository

**Route**: `/connect`
**Purpose**: Entry point for analysis. Three input methods.

### Key State
```typescript
const [url, setUrl] = useState("");
const [loading, setLoading] = useState(false);
const [repos, setRepos] = useState<GitHubRepo[]>([]);
const [uploadFiles, setUploadFiles] = useState<{ file: File; path: string }[]>([]);
const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
```

### Three Sections

**1. URL Input**: Text field + "Analyze" button → POSTs to `/api/github/tree` → saves to `localStorage("treeData")` → `router.push("/configure")`

**2. GitHub Repos** (authenticated only): Auto-loads from `/api/github/repos`, searchable grid. Clicking a repo card calls `/api/github/tree` with `{ owner, repo }`.

**3. Upload Drop Zone**: Drag-and-drop with `FileSystemEntry` API for folder support. Reads entries recursively via `readDroppedEntries()`. On submit: POSTs FormData to `/api/upload` → saves `projectData` and synthetic `treeData` (with `owner: "__upload__"`) → navigates to `/configure`.

### Duplicate Detection
Checks `sessions` from `useProjectSessions()` against `repoName`. If duplicate found, shows warning with "View Previous Results" and "Analyze Again" options.

### `readDroppedEntries()` Helper
```typescript
async function readDroppedEntries(items: DataTransferItemList): Promise<{ file: File; path: string }[]> {
  // Uses FileSystemDirectoryReader.readEntries() in batches
  // Recursively traverses directories
  // Returns flat list with relative paths preserved
}
```

### Synthetic treeData for uploads
```typescript
const syntheticTree: FetchTreeResult = {
  files: data.files.map((f) => ({ path: f.path, sha: "", size: f.size, language: f.language, excluded: false })),
  excludedFiles: [],
  repoName: data.repoName,
  owner: "__upload__",   // ← sentinel value checked in configure
  repo: data.repoName,
  totalFiles: data.fileCount,
  totalExcludedFiles: 0,
  totalSize: data.totalSize,
  languages: data.languages,
  filterSummary: { totalScanned: data.fileCount, totalIncluded: data.fileCount, totalExcluded: 0, excludedByReason: { too_large: 0, binary_file: 0, ignored_directory: 0, unsupported_extension: 0, non_file: 0 } },
};
```

---

## `app/(main)/configure/page.tsx` — Configure Analysis

**Route**: `/configure`
**Purpose**: Select skill level, role, and files before analysis.

### Key State
```typescript
const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
const [skillLevel, setSkillLevel] = useState<ProcessConfig["skillLevel"] | null>(null);
const [selectedRole, setSelectedRole] = useState<RolePreset | null>(null);
const [customRole, setCustomRole] = useState("");
const [showFiltered, setShowFiltered] = useState(false);
const [filterReasonFilter, setFilterReasonFilter] = useState<FilterReason | "all">("all");
```

### Auto-Redirect
If `treeData` is null after loading → `router.push("/connect")`

### Default File Selection (render-time init)
```typescript
if (sortedFiles.length > 0 && !initialized) {
  const initial = new Set<string>();
  for (const file of sortedFiles) {
    if (file.size < FILE_SIZE_WARNING_BYTES && !file.excluded) {
      initial.add(file.path);
    }
  }
  setSelectedPaths(initial);
  setInitialized(true);
}
```
Files are sorted by size descending. Files ≥ `FILE_SIZE_WARNING_BYTES` (50KB) are pre-excluded and highlighted yellow.

### Three Sections
1. **Skill Level**: 3 emoji cards (beginner/intermediate/advanced) from `SKILL_LEVEL_OPTIONS`
2. **Role**: 6 preset role cards from `ROLE_PRESETS` + custom text input
3. **File Selection**: Scrollable list (max 400px) with checkbox-style toggle, size badge, language badge

### Filtered Files Accordion
Collapsible section showing excluded files grouped by `FilterReason`. Per-reason filter buttons. "Include" button per file to add to selection. "Include All" bulk action.

### Submit → `ProcessConfig`
```typescript
const config: ProcessConfig = {
  owner: treeData.owner,
  repo: treeData.repo,
  selectedFiles,            // TreePreviewFile[]
  skillLevel,
  repoName: treeData.repoName,
  role: selectedRole
    ? { preset: selectedRole, custom: null }
    : customRole.trim()
      ? { preset: null, custom: customRole.trim() }
      : { preset: "fullstack_dev", custom: null },
  ...(isUpload && { isUpload: true }),
};
setProcessConfig(config);
router.push("/processing");
```

---

## `app/(main)/processing/page.tsx` — Processing / SSE Stream

**Route**: `/processing`
**Purpose**: Shows real-time pipeline progress via SSE.

### Key Behavior
- Reads `processConfig` from localStorage
- Calls `useProcessing().process(config)` which opens SSE stream
- Shows step progress with status indicators
- On complete → saves session to localStorage → enables "View Results" button
- On error → shows error + retry option

### Processing Steps Display
```typescript
// Steps are shown as a checklist with status:
// idle: gray circle
// in_progress: spinning animation (animate-pulse-brutal)
// done: green checkmark
```

### Desktop Notification
After analysis completes, fires `new Notification("Analysis Complete!")` (if permission granted).

### Auto-save to localStorage
```typescript
// On status === "complete":
saveSession({
  id: crypto.randomUUID(),
  repoName: config.repoName,
  analyzedAt: new Date().toISOString(),
  projectData: results.projectData,
  analysisData: results.analysis,
  learningPath: results.learningPath,
  exercises: results.exercises,
  skillLevel: config.skillLevel,
  repoUrl: `https://github.com/${config.owner}/${config.repo}`,
});
```

---

## `app/(main)/results/page.tsx` — Results / Learning View

**Route**: `/results`
**Purpose**: Main learning interface with 3 tabs.

### Tabs
- **Tutorial**: Chapter-based learning content
- **Learn**: V2 skill tree learning path
- **Exercises**: Interactive coding challenges

### Key State
```typescript
const [activeTab, setActiveTab] = useState<TabId>("summary");
const [activeChapterIndex, setActiveChapterIndex] = useState<number | null>(null);
```

### Data Source
```typescript
const { activeSession } = useProjectSessions();
// Falls back to results.* from useProcessing() if no session
```

### Tutorial Tab Architecture
- Shows `TutorialOverview` with chapter cards when `activeChapterIndex === null`
- Shows `TutorialChapter` when a chapter is selected
- Supports prev/next navigation and cross-chapter links

### Save to Dashboard (authenticated users)
Button that POSTs to `/api/projects/save` with complete session data. Shows spinner → success toast.

### Sidebar Navigation (desktop)
Scrollspy sidebar tracking sections via `useScrollspy`. Shows chapter list for Tutorial tab. Fixed at `top-24`, hidden on mobile.

---

## `app/(main)/assess/page.tsx` — Skill Assessment Quiz

**Route**: `/assess`
**Purpose**: 8-question quiz to determine skill level.

### Flow
1. Reads `analysisData` from localStorage (redirects to `/connect` if missing)
2. Fetches 8 quiz questions from `/api/assess/questions`
3. Shows questions one at a time with A/B/C/D options
4. On last question submit → POSTs to `/api/assess/evaluate`
5. Shows results: score, topic breakdown, answer review

### Quiz View
```typescript
// For each question:
<Badge variant="difficulty">{question.difficulty}</Badge>
<Badge>{question.topic}</Badge>
<h3>{question.question}</h3>
{question.options.map((opt, i) => (
  <button onClick={() => setSelectedAnswer(i)}
    className={selectedAnswer === i ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "..."}>
    <span>{String.fromCharCode(65 + i)}.</span> {opt}
  </button>
))}
```

### Results View
- Score percentage (large number)
- Color-coded progress bar (green ≥70, yellow ≥40, red <40)
- Topic breakdown: per-topic correct/total with icons
- Answer review: each Q/A with explanation
- CTA: "Start Learning" → `/learn` or "Retake Quiz"

---

## `app/(main)/upload/page.tsx` — Upload Page (Dedicated)

**Route**: `/upload`
**Purpose**: Dedicated full-page upload UI (the connect page also has inline upload).

Same logic as connect page upload section:
- Drop zone with `FileSystemEntry` API for folder support
- Hidden `<input type="file" multiple>` and `<input webkitdirectory>`
- File list with remove-per-file and "Clear all"
- Upload → `/api/upload` → save to localStorage → navigate to `/configure`

---

## `app/(main)/dashboard/page.tsx` — User Dashboard

**Route**: `/dashboard` (protected by middleware)
**Purpose**: Authenticated user's saved projects hub.

### Auth Guard
```typescript
// Middleware already redirects unauthenticated users
// Component also checks: if (!authLoading && !user) → router.push("/login")
```

### Stats (derived from saved projects)
- Projects Analyzed count
- Total Files count
- Technologies count (unique across all projects)

### Saved Analyses Grid
Each card shows: repo name, date, file count, tech stack badges. Click → `router.push("/results")`. Delete with confirmation (two-step: trash icon → "Delete"/"Cancel").

### Quick Actions
3 cards: "Analyze a Project" (→ /connect), "View Results" (→ /results), "Practice Exercises" (→ /exercises)

---

## `app/(main)/history/page.tsx` — Analysis History

**Route**: `/history`
**Purpose**: localStorage-based session history (works without login).

### Data Source
```typescript
const { sessions, removeSession, setActiveSession, favorites, toggleFavorite, isLoaded } = useProjectSessions();
```

### Session Cards
Sorted: favorites first. Each card shows:
- Repo name, date, file count, skill level badge
- ⭐ Favorite toggle button
- GitHub URL external link
- Delete with confirm pattern

### Open Session
```typescript
const handleOpenProject = (id: string) => {
  setActiveSession(id);   // Sets activeSessionId in localStorage
  router.push("/results");
};
```

---

## `app/(main)/exercises/page.tsx` — Exercises (Redirect)

```typescript
// Immediately redirects to /results
useEffect(() => { router.replace("/results"); }, [router]);
```

---

## `app/(main)/learn/page.tsx` — Learn (Redirect)

```typescript
// Immediately redirects to /results
useEffect(() => { router.replace("/results"); }, [router]);
```

---

## `app/(main)/analyze/page.tsx` — Analyze (Redirect)

```typescript
// Immediately redirects to /results
useEffect(() => { router.replace("/results"); }, [router]);
```

---

## Layout Files

### `app/layout.tsx` — Root Layout (Server Component)

```typescript
import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CodeCocoon — Understand Your AI-Generated Code",
  description: "CodeCocoon analyzes your GitHub repository or uploaded code and creates personalized learning paths and exercises to help you understand every line.",
  keywords: ["AI code analysis", "learning paths", "GitHub", "code education", "programming"],
  openGraph: {
    title: "CodeCocoon",
    description: "Understand your AI-generated code with personalized learning paths",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${dmSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
```

### `app/(auth)/layout.tsx`

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

### `app/(main)/layout.tsx`

No wrapper — pages render directly with root layout.

### `middleware.ts` (root)

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
