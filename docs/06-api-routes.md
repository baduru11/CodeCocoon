# CodeCocoon — API Routes

All routes live in `app/api/`. Import pattern: `import { createClient } from "@/lib/supabase/server"`.

---

## ★ `POST /api/process` — Main Pipeline (SSE Stream)

**File**: `app/api/process/route.ts`

The most important route. Runs the full analysis + tutorial + learning path + exercises pipeline and streams incremental results as Server-Sent Events.

### Request Body
```typescript
{
  owner: string;
  repo: string;
  selectedFiles: { path: string; sha: string; size: number }[];
  skillLevel: string;
  role?: { preset: string | null; custom: string | null };
  uploadedFiles?: RepoFile[]; // For local file uploads
}
```

### SSE Event Types (streamed)
Each event: `data: {"type": "...", "data": ...}\n\n`

| Event Type | Data | Notes |
|------------|------|-------|
| `status` | `string` (status message) | Human-readable progress |
| `step_start` | `string` (step key) | Step beginning |
| `files_fetched` | `FetchRepoResult` | All files loaded |
| `tech_stack` | `TechStack` | Gemini analysis |
| `architecture` | `ArchitectureInfo` | Gemini analysis |
| `key_files` | `KeyFile[]` | Gemini analysis |
| `tutorial_abstractions` | `TutorialAbstraction[]` | Core concepts |
| `tutorial_relationships` | `TutorialRelationships` | Concept relationships |
| `tutorial_order` | `number[]` | Pedagogical chapter order |
| `tutorial_chapter` | `{ chapterNum, total, chapter }` | Per-chapter as written |
| `summary` | `string` | Markdown overview |
| `learning_concepts` | `RawConcept[]` | Role-filtered concepts |
| `learning_graph` | `{ graphNodes, gapAnalysis }` | Dependency graph |
| `learning_lessons` | `RawLesson[]` | Lesson content |
| `learning_resources` | `RawResource[]` | Learning resources |
| `learning_path` | `LearningPathV2` | Complete learning path |
| `exercises` | `Exercise[]` | All 8 exercises |
| `complete` | `{ projectData, analysis, learningPath, exercises }` | Final aggregate |
| `error` | `{ message: string }` | On failure |

### Pipeline Sequence
```
1. Fetch files (GitHub or use uploadedFiles)
2. analyzeTechStack (fast model)
3. analyzeArchitecture (fast model)
4. identifyKeyFiles (fast model)
5. runTutorialPipeline → 4 sub-steps (abstractions, relationships, order, chapters)
6. runLearningPipeline → 4 sub-steps (concepts, graph, lessons, resources)
7. generateExercises (deep model, 8 exercises)
8. Send complete event
```

### Upload Mode
When `uploadedFiles` is provided, the route skips GitHub fetch and filters to `selectedFiles` paths.

### Auth Token Handling
Reads `session.provider_token` from Supabase session for elevated GitHub rate limit. Falls back to unauthenticated (60 req/hr).

---

## `POST /api/github/tree`

Fetches repository file tree metadata (no content). Returns `FetchTreeResult`.

**Request**: `{ url?: string, owner?: string, repo?: string }`
**Response**: `FetchTreeResult`

Gets GitHub auth token from Supabase session. Returns 429 with `{ rateLimited: true }` on rate limit.

---

## `POST /api/github/fetch`

Fetches full file contents for a repo. Returns `FetchRepoResult`.

**Request**: `{ url?: string, owner?: string, repo?: string }`

---

## `GET /api/github/repos`

Lists authenticated user's public repositories.

**Headers**: Requires auth session with `provider_token`
**Response**: `{ repos: GitHubRepo[] }`

---

## `POST /api/upload`

Handles multipart form data file upload.

**Request**: `FormData` with `files` field (multiple)
**Response**: `{ files: RepoFile[], repoName: string, fileCount: number, languages, totalSize }`

Limits: 200 files max, 10MB total. Skips binary files and files > 100KB.
Derives `repoName` from common top-level directory (e.g. `my-app/src/...` → `"my-app"`).

---

## `POST /api/exercises/evaluate`

Evaluates a user's answer to an exercise using Gemini.

**Request**: `{ exerciseType: string, prompt: string, expectedAnswer: string, userAnswer: string }`
**Response**: `{ isCorrect: boolean, feedback: string }`

Uses anti-cheat detection (rejects code-only answers for text exercises).

---

## `POST /api/exercises/generate`

Standalone exercise generation (not used in main pipeline).

**Request**: `{ files: RepoFile[], skillLevel: string }`
**Response**: `{ exercises: Exercise[] }`

---

## `POST /api/assess/questions`

Generates 8 quiz questions for skill assessment.

**Request**: `{ techStack: string[], skillLevel: string }`
**Response**: `{ questions: QuizQuestion[] }`

Distribution: 3 beginner + 3 intermediate + 2 advanced questions.

---

## `POST /api/assess/evaluate`

Scores quiz answers. Not an AI call — pure client-side logic in the assess page.

---

## `POST /api/learn/generate`

Standalone learning path generation (not used in main pipeline).

---

## `POST /api/projects/save`

Saves a complete project analysis to Supabase. Requires authentication.

**Request**:
```typescript
{
  repoName: string;
  githubOwner: string;
  githubRepo: string;
  githubUrl?: string;
  files: RepoFile[];
  analysis: AnalysisResult;
  learningPath?: LearningPath;
  exercises?: Exercise[];
  skillLevel?: string;
}
```

**Response**: `{ projectId: string, success: true }`

Saves in order: project → files → analysis → learningPath → exercises → status=complete

---

## `GET /api/projects/list`

Lists user's saved projects with analysis summaries.

**Response**: `(Project & { analysis_results: { summary, tech_stack }[] })[]`

---

## `POST /api/projects/check-duplicate`

Checks if a GitHub repo is already saved for the current user.

**Request**: `{ githubOwner: string, githubRepo: string }`
**Response**: `{ exists: boolean, project?: Project }`

---

## `GET /api/projects/[id]`

Fetches complete project data (project + analysis + learning paths + exercises).

**Response**: `{ project, analysis, learningPaths, exercises }`
Requires authentication. Returns 404 if not found.

---

## `DELETE /api/projects/[id]`

Deletes a project. RLS ensures only owner can delete.
Child rows (files, analysis, exercises) cascade-delete automatically.

**Response**: `{ success: true }`

---

## Auth Route

### `GET /auth/callback` — OAuth Callback

**File**: `app/(auth)/auth/callback/route.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/connect";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocalEnv = process.env.NODE_ENV === "development";
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=true`);
}
```

---

## Error Handling Convention

All API routes return:
- `200` with data on success
- `400` for invalid request parameters
- `401` for missing authentication
- `404` for not found
- `429` for rate limit exceeded (GitHub)
- `500` for server errors

All error responses: `{ error: string }`
