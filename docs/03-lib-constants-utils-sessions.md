# CodeCocoon — lib/constants, lib/utils, lib/project-sessions

---

## `lib/constants.ts`

```typescript
// File extensions to include in analysis
export const SOURCE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rb", "go", "rs", "java", "kt", "swift", "cs",
  "cpp", "c", "h", "hpp",
  "php", "vue", "svelte",
  "html", "css", "scss", "sass", "less",
  "sql", "graphql", "gql",
  "sh", "bash", "zsh",
  "yaml", "yml", "toml",
  "json", "md", "mdx",
  "dockerfile",
]);

// Config files to always include (by filename)
export const CONFIG_FILES = new Set([
  "package.json",
  "tsconfig.json",
  "next.config.ts",
  "next.config.js",
  "next.config.mjs",
  "vite.config.ts",
  "vite.config.js",
  "webpack.config.js",
  "tailwind.config.ts",
  "tailwind.config.js",
  ".eslintrc.json",
  "eslint.config.mjs",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.yaml",
  "requirements.txt",
  "Pipfile",
  "Gemfile",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  ".env.example",
  ".env.local.example",
  "prisma/schema.prisma",
]);

// Directories to always skip
export const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".next", ".nuxt", "__pycache__", ".cache",
  "dist", "build", "out", ".vercel", ".turbo", "coverage", ".nyc_output",
  "vendor", ".bundle", "target", "bin", "obj", ".idea", ".vscode", ".DS_Store",
]);

// Binary extensions to skip
export const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "ico", "webp", "bmp", "tiff",
  "mp3", "mp4", "avi", "mov", "webm", "wav", "ogg",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "zip", "tar", "gz", "rar", "7z",
  "woff", "woff2", "ttf", "eot", "otf",
  "exe", "dll", "so", "dylib",
  "lock",
]);

// Skill levels
export const SKILL_LEVELS = {
  beginner: { label: "Beginner", color: "bg-accent-green", emoji: "🐛" },
  intermediate: { label: "Intermediate", color: "bg-accent-yellow", emoji: "🪺" },
  advanced: { label: "Advanced", color: "bg-accent-purple", emoji: "🦋" },
} as const;

// Max files to analyze
export const MAX_FILES_TO_FETCH = 100;
export const MAX_FILE_SIZE_BYTES = 100_000;   // 100KB per file
export const MAX_TOTAL_CONTENT_BYTES = 500_000; // 500KB total
export const FILE_SIZE_WARNING_BYTES = 50_000;  // 50KB — shown in configure page

// Gemini model names
export const GEMINI_MODELS = {
  fast: "gemini-2.5-flash-lite",
  deep: "gemini-2.5-flash",
} as const;

// GitHub API
export const GITHUB_API_BASE = "https://api.github.com";
export const GITHUB_RATE_LIMIT_UNAUTH = 60;
export const GITHUB_RATE_LIMIT_AUTH = 5000;
export const GITHUB_BATCH_CONCURRENCY = 5;

// App
export const APP_NAME = "CodeCocoon";
export const APP_DESCRIPTION = "Your code is wrapped up. Let's unwrap it together.";

// Skill level options for configure page
export const SKILL_LEVEL_OPTIONS = [
  {
    value: "beginner" as const,
    label: "Beginner",
    emoji: "🐛",
    description: "I'm new to coding or used AI to generate my project",
  },
  {
    value: "intermediate" as const,
    label: "Intermediate",
    emoji: "🪺",
    description: "I understand basics but want to deepen my knowledge",
  },
  {
    value: "advanced" as const,
    label: "Advanced",
    emoji: "🦋",
    description: "I'm experienced and want to learn advanced patterns",
  },
];

// Exercise type configuration
export const EXERCISE_TYPES = {
  error_injection: { label: "Bug Hunt", icon: "Bug", color: "bg-primary" },
  code_recreation: { label: "Fill in Blank", icon: "PenTool", color: "bg-secondary" },
  code_explanation: { label: "Explain", icon: "MessageSquare", color: "bg-accent-purple" },
  mcq: { label: "Multiple Choice", icon: "MessageSquare", color: "bg-secondary" },
  output_prediction: { label: "Predict Output", icon: "MessageSquare", color: "bg-accent-yellow" },
  parsons: { label: "Code Order", icon: "ArrowDownUp", color: "bg-accent-green" },
  error_message: { label: "Fix the Error", icon: "AlertTriangle", color: "bg-primary" },
} as const;

// Processing steps for the processing page
export const PROCESSING_STEPS = [
  { key: "files_fetched", label: "Fetching file contents" },
  { key: "tech_stack", label: "Detecting tech stack" },
  { key: "architecture", label: "Analyzing architecture" },
  { key: "key_files", label: "Identifying key files" },
  { key: "tutorial_abstractions", label: "Identifying core concepts" },
  { key: "tutorial_relationships", label: "Mapping relationships" },
  { key: "tutorial_order", label: "Planning chapter order" },
  { key: "tutorial_chapters", label: "Writing tutorial chapters" },
  { key: "learning_concepts", label: "Extracting role-based concepts" },
  { key: "learning_graph", label: "Building skill dependency graph" },
  { key: "learning_lessons", label: "Generating lesson content" },
  { key: "learning_resources", label: "Curating learning resources" },
  { key: "exercises", label: "Creating exercises" },
] as const;
```

---

## `lib/utils.ts`

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + "...";
}

export function getLanguageFromExtension(ext: string): string {
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript (React)",
    js: "JavaScript", jsx: "JavaScript (React)",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust",
    java: "Java", kt: "Kotlin", swift: "Swift", cs: "C#",
    cpp: "C++", c: "C", php: "PHP",
    html: "HTML", css: "CSS", scss: "SCSS",
    json: "JSON", yaml: "YAML", yml: "YAML",
    md: "Markdown", sql: "SQL",
    sh: "Shell", bash: "Shell",
    dockerfile: "Docker", vue: "Vue", svelte: "Svelte",
  };
  return map[ext.toLowerCase()] || ext.toUpperCase();
}

export function getFileExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

export function bytesToSize(bytes: number): string {
  const sizes = ["Bytes", "KB", "MB", "GB"];
  if (bytes === 0) return "0 Bytes";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i)) + " " + sizes[i];
}

/**
 * Normalize code strings that may be double-escaped from JSON serialization.
 * When Gemini returns code inside JSON, \n sometimes comes through as literal
 * backslash-n. This detects and fixes that.
 */
export function normalizeCode(code: string): string {
  if (!code) return "";
  const realNewlines = (code.match(/\n/g) || []).length;
  const literalNewlines = (code.match(/\\n/g) || []).length;
  if (literalNewlines > 0 && realNewlines <= 1) {
    return code
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
  return code;
}
```

---

## `lib/project-sessions.ts`

Manages `ProjectSession[]` in localStorage. Key structure:
- `"projectSessions"` — array of all sessions
- `"activeSessionId"` — string ID of current session
- `"favoriteSessionIds"` — JSON array of favorited IDs

```typescript
import type { ProjectSession } from "@/types/project-session";
import type { Exercise } from "@/types/exercise";

const SESSIONS_KEY = "projectSessions";
const ACTIVE_KEY = "activeSessionId";
const FAVORITES_KEY = "favoriteSessionIds";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAllSessions(): ProjectSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectSession[];
  } catch {
    console.warn("Failed to parse project sessions from localStorage");
    return [];
  }
}

export function getSession(id: string): ProjectSession | null {
  const sessions = getAllSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export function saveSession(session: ProjectSession): void {
  if (!isBrowser()) return;
  try {
    const sessions = getAllSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session); // Most recent first
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.warn("Failed to save project session:", err);
  }
}

export function deleteSession(id: string): void {
  if (!isBrowser()) return;
  try {
    const session = getSession(id);
    const sessions = getAllSessions().filter((s) => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    const activeId = getActiveSessionId();
    if (activeId === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
    // Clear treeData if it belongs to the deleted session
    if (session) {
      try {
        const raw = localStorage.getItem("treeData");
        if (raw) {
          const treeData = JSON.parse(raw);
          if (treeData?.repoName === session.repoName) {
            localStorage.removeItem("treeData");
          }
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    console.warn("Failed to delete project session:", err);
  }
}

export function getActiveSessionId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_KEY) ?? null;
}

export function setActiveSessionId(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveSession(): ProjectSession | null {
  const id = getActiveSessionId();
  if (!id) return null;
  return getSession(id);
}

export function updateSessionExercises(id: string, exercises: Exercise[]): void {
  const session = getSession(id);
  if (!session) return;
  session.exercises = exercises;
  saveSession(session);
}

export function getFavoriteIds(): Set<string> {
  if (!isBrowser()) return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function toggleFavorite(id: string): Set<string> {
  const favs = getFavoriteIds();
  if (favs.has(id)) {
    favs.delete(id);
  } else {
    favs.add(id);
  }
  if (isBrowser()) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
  }
  return favs;
}
```

---

## localStorage Key Map

All keys used throughout the app:

| Key | Type | Purpose |
|-----|------|---------|
| `projectSessions` | `ProjectSession[]` JSON | All analyzed sessions |
| `activeSessionId` | `string` | Currently active session |
| `favoriteSessionIds` | `string[]` JSON | Starred sessions |
| `treeData` | `FetchTreeResult` JSON | Repo tree from /connect step |
| `processConfig` | `ProcessConfig` JSON | Config passed to /processing |
| `projectData` | `FetchRepoResult` JSON | Files from upload (passed to /api/process) |
