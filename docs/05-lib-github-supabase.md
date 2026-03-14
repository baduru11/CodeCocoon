# CodeCocoon — lib/github & lib/supabase

---

## `lib/github/parser.ts`

```typescript
import type { ParsedGitHubUrl } from "@/types/github";

/**
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch
 * - github.com/owner/repo
 * - owner/repo (short form)
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  const trimmed = input.trim();
  const urlPatterns = [
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  ];
  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern);
    if (match) return { owner: match[1], repo: match[2] };
  }
  // Short form: owner/repo
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) return { owner: shortMatch[1], repo: shortMatch[2] };
  return null;
}

export function buildGitHubUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

export function isValidGitHubInput(input: string): boolean {
  return parseGitHubUrl(input) !== null;
}

export function isValidGitHubName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && name.length > 0 && name.length <= 100;
}
```

---

## `lib/github/filter.ts`

```typescript
import { SOURCE_EXTENSIONS, CONFIG_FILES, IGNORED_DIRS, BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import type { GitHubTreeItem, FilterReason, FilterSummary } from "@/types/github";
import { getFileExtension, bytesToSize } from "@/lib/utils";

interface FilterResult {
  included: GitHubTreeItem[];
  excluded: Array<GitHubTreeItem & { filterReason: FilterReason; filterDetails: string }>;
  summary: FilterSummary;
}

/**
 * Filter tree items with metadata about what was excluded and why.
 * Exclusion priority: non_file → too_large → ignored_directory → binary_file → unsupported_extension
 */
export function filterSourceFilesWithMetadata(tree: GitHubTreeItem[]): FilterResult {
  const included: GitHubTreeItem[] = [];
  const excluded: Array<GitHubTreeItem & { filterReason: FilterReason; filterDetails: string }> = [];
  const reasonCounts: Record<FilterReason, number> = {
    too_large: 0, binary_file: 0, ignored_directory: 0,
    unsupported_extension: 0, non_file: 0,
  };

  for (const item of tree) {
    if (item.type !== "blob") {
      excluded.push({ ...item, filterReason: "non_file", filterDetails: "Not a file (directory or symlink)" });
      reasonCounts.non_file++;
      continue;
    }
    if (item.size && item.size > MAX_FILE_SIZE_BYTES) {
      excluded.push({ ...item, filterReason: "too_large", filterDetails: `${bytesToSize(item.size)} exceeds ${bytesToSize(MAX_FILE_SIZE_BYTES)} limit` });
      reasonCounts.too_large++;
      continue;
    }
    const pathParts = item.path.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const ext = getFileExtension(fileName);

    let inIgnoredDir = false;
    for (const part of pathParts) {
      if (IGNORED_DIRS.has(part)) {
        excluded.push({ ...item, filterReason: "ignored_directory", filterDetails: `In ignored directory: ${part}` });
        reasonCounts.ignored_directory++;
        inIgnoredDir = true;
        break;
      }
    }
    if (inIgnoredDir) continue;

    if (BINARY_EXTENSIONS.has(ext)) {
      excluded.push({ ...item, filterReason: "binary_file", filterDetails: `Binary file type: .${ext}` });
      reasonCounts.binary_file++;
      continue;
    }

    if (CONFIG_FILES.has(fileName) || CONFIG_FILES.has(item.path)) { included.push(item); continue; }
    if (SOURCE_EXTENSIONS.has(ext)) { included.push(item); continue; }
    if (fileName === "Dockerfile" || fileName.startsWith("Dockerfile.")) { included.push(item); continue; }

    excluded.push({ ...item, filterReason: "unsupported_extension", filterDetails: ext ? `Extension .${ext} not recognized` : "No file extension" });
    reasonCounts.unsupported_extension++;
  }

  return {
    included, excluded,
    summary: { totalScanned: tree.length, totalIncluded: included.length, totalExcluded: excluded.length, excludedByReason: reasonCounts },
  };
}

/** Legacy function — prefer filterSourceFilesWithMetadata */
export function filterSourceFiles(tree: GitHubTreeItem[]): GitHubTreeItem[] {
  return filterSourceFilesWithMetadata(tree).included;
}

export function getLanguageStats(files: { path: string; size: number }[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const file of files) {
    const ext = getFileExtension(file.path);
    const lang = extToLanguage(ext);
    stats[lang] = (stats[lang] || 0) + 1;
  }
  return stats;
}

function extToLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript",
    py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java",
    kt: "Kotlin", swift: "Swift", cs: "C#", cpp: "C++", c: "C",
    php: "PHP", html: "HTML", css: "CSS", scss: "CSS", json: "JSON",
    yaml: "YAML", yml: "YAML", md: "Markdown", vue: "Vue", svelte: "Svelte", sql: "SQL",
  };
  return map[ext.toLowerCase()] || ext.toUpperCase();
}
```

---

## `lib/github/fetcher.ts`

```typescript
import { Octokit } from "octokit";
import pLimit from "p-limit";
import type { RepoFile, FetchRepoResult, FetchTreeResult, TreePreviewFile, GitHubTree } from "@/types/github";
import { filterSourceFiles, filterSourceFilesWithMetadata, getLanguageStats } from "./filter";
import { getLanguageFromExtension, getFileExtension } from "@/lib/utils";
import { MAX_FILES_TO_FETCH, MAX_TOTAL_CONTENT_BYTES, GITHUB_BATCH_CONCURRENCY } from "@/lib/constants";

const MAX_EXCLUDED_TO_RETURN = 1000;

interface FetchOptions {
  token?: string;
  branch?: string;
  maxFiles?: number;
}

/**
 * Fetch repository file tree + contents.
 * Falls back to unauthenticated on 401/403.
 */
export async function fetchRepoFiles(
  owner: string, repo: string, options: FetchOptions = {}
): Promise<FetchRepoResult> { /* ... */ }

/**
 * Fetch repository file tree metadata WITHOUT content.
 * Returns TreePreviewFile[] for the configure page selection UI.
 */
export async function fetchRepoTree(
  owner: string, repo: string, options: FetchOptions = {}
): Promise<FetchTreeResult> { /* ... */ }

/**
 * Fetch content for specific selected files (after tree preview).
 * Uses batchFetchContents with p-limit(GITHUB_BATCH_CONCURRENCY=5).
 */
export async function fetchContentForFiles(
  owner: string, repo: string,
  files: { path: string; sha: string; size: number }[],
  options: FetchOptions = {}
): Promise<RepoFile[]> { /* ... */ }

export function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number }).status;
  const message = (error as { message?: string }).message || "";
  return (status === 403 && message.toLowerCase().includes("rate limit"))
    || status === 429
    || message.toLowerCase().includes("quota exhausted");
}

function createOctokit(token: string): Octokit {
  // Only pass auth if token looks valid (not placeholder, min 10 chars)
  const cleaned = token.trim();
  const isPlaceholder = !cleaned || cleaned.includes("your-") || cleaned.includes("placeholder")
    || cleaned.includes("example") || cleaned.length < 10;
  return isPlaceholder ? new Octokit() : new Octokit({ auth: cleaned });
}
```

**Batch fetch strategy**: Uses `p-limit(5)` to fetch up to 5 files concurrently from the GitHub Blobs API. Content is base64-decoded via `Buffer.from(data.content, "base64").toString("utf-8")`. Stops fetching when `MAX_TOTAL_CONTENT_BYTES` (500KB) is reached.

---

## `lib/github/client.ts`

```typescript
import { Octokit } from "octokit";
import type { GitHubRepo } from "@/types/github";

const MAX_PAGES = 5;
const PER_PAGE = 100;

/** Fetch authenticated user's public repositories (paginated, up to 500). */
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const octokit = new Octokit({ auth: token });
  const allRepos: GitHubRepo[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated", per_page: PER_PAGE, type: "public", page,
    });
    for (const repo of data) {
      allRepos.push({
        id: repo.id, name: repo.name, full_name: repo.full_name,
        description: repo.description, html_url: repo.html_url,
        language: repo.language, stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at || "", private: repo.private,
        default_branch: repo.default_branch,
        owner: { login: repo.owner.login, avatar_url: repo.owner.avatar_url },
      });
    }
    if (data.length < PER_PAGE) break;
  }
  return allRepos;
}
```

---

## `lib/supabase/client.ts` (Browser)

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Placeholder for build time / unconfigured environments
    return createBrowserClient("https://placeholder.supabase.co", "placeholder-key");
  }
  return createBrowserClient(url, key);
}
```

---

## `lib/supabase/server.ts` (Server Components + API Routes)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — ignored if middleware refreshes sessions
        }
      },
    },
  });
}
```

---

## `lib/supabase/middleware.ts`

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // MUST call getUser() to validate JWT — DO NOT skip
  const { data: { user } } = await supabase.auth.getUser();

  // Only protect /dashboard route — everything else is public
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

---

## `lib/supabase/db.ts` — Database Operations

All functions take a `SupabaseClient` instance as the first argument.

```typescript
// Write operations
export async function saveProject(supabase, data: SaveProjectData): Promise<string>
export async function updateProjectStatus(supabase, projectId: string, status: Project["status"]): Promise<void>
export async function saveProjectFiles(supabase, projectId: string, files: RepoFile[]): Promise<void>
export async function saveAnalysisResult(supabase, projectId: string, analysis: AnalysisResult): Promise<void>
export async function saveLearningPath(supabase, projectId: string, skillLevel: string, path: LearningPath): Promise<void>
export async function saveExercises(supabase, projectId: string, exercises: Exercise[]): Promise<void>

// Read operations
export async function getUserProjects(supabase): Promise<(Project & { analysis_results: ... })[]>
export async function findDuplicateProject(supabase, githubOwner: string, githubRepo: string): Promise<Project | null>
export async function getProjectWithAllData(supabase, projectId: string): Promise<{ project, analysis, learningPaths, exercises } | null>
```

### V1 vs V2 Learning Paths in DB
- **V1**: Stored in `modules` JSONB column, `version=1`
- **V2**: Stored in `skill_graph` JSONB column with `{ modules, nodes, edges }`, `version=2`, plus `role` and `gap_analysis` columns

### DB Row → Domain Type Transformers
- `dbRowToExercise(row)` — Handles legacy wrapped formats like `{ items: [...] }` and `{ value: "..." }`
- `dbRowToAnalysis(row)` — Maps snake_case columns to camelCase `AnalysisResult`
