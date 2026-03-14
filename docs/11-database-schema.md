# CodeCocoon — Database Schema (Supabase / PostgreSQL)

---

## Tables Overview

| Table | Purpose |
|-------|---------|
| `projects` | Top-level project record per user |
| `project_files` | Individual source files for a project |
| `analysis_results` | AI analysis output (tech stack, arch, key files) |
| `learning_paths` | Tutorial + learning path data (V1 and V2) |
| `exercises` | Generated coding exercises |

All tables use `uuid` primary keys. Foreign keys cascade-delete from `projects`.

---

## SQL Schema

```sql
-- ─── PROJECTS ──────────────────────────────────────────────────────
CREATE TABLE projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_name    TEXT NOT NULL,
  github_owner TEXT,
  github_repo  TEXT,
  github_url   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
                -- values: 'pending' | 'processing' | 'complete' | 'error'
  file_count   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── PROJECT FILES ──────────────────────────────────────────────────
CREATE TABLE project_files (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  content    TEXT,
  language   TEXT,
  size       INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ANALYSIS RESULTS ───────────────────────────────────────────────
CREATE TABLE analysis_results (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary      TEXT,
  tech_stack   JSONB,          -- { languages[], frameworks[], databases[], tools[], styling[] }
  architecture JSONB,          -- { pattern, description, layers[], entryPoints[] }
  key_files    JSONB,          -- KeyFile[]
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── LEARNING PATHS ─────────────────────────────────────────────────
CREATE TABLE learning_paths (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  skill_level  TEXT,           -- 'beginner' | 'intermediate' | 'advanced'
  title        TEXT,
  description  TEXT,
  version      INTEGER DEFAULT 1,  -- 1 = V1, 2 = V2
  modules      JSONB,          -- V1: LearningModule[] array
  skill_graph  JSONB,          -- V2: { modules[], nodes[], edges[] }
  gap_analysis JSONB,          -- V2 gap analysis object
  role         TEXT,           -- V2 role preset or custom string
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── EXERCISES ──────────────────────────────────────────────────────
CREATE TABLE exercises (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type                TEXT NOT NULL,
    -- 'error_injection' | 'code_recreation' | 'code_explanation' |
    -- 'mcq' | 'output_prediction' | 'parsons' | 'error_message'
  difficulty          TEXT,    -- 'beginner' | 'intermediate' | 'advanced'
  title               TEXT NOT NULL,
  prompt              TEXT NOT NULL,
  original_code       TEXT,
  modified_code       TEXT,
  expected_answer     TEXT,
  hints               JSONB,   -- string[]
  related_file        TEXT,
  options             JSONB,   -- string[] (for mcq/output_prediction)
  correct_option_index INTEGER,
  explanation         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Indexes

```sql
-- Primary access patterns
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_project_files_project_id ON project_files(project_id);
CREATE INDEX idx_analysis_results_project_id ON analysis_results(project_id);
CREATE INDEX idx_learning_paths_project_id ON learning_paths(project_id);
CREATE INDEX idx_exercises_project_id ON exercises(project_id);

-- Duplicate detection
CREATE INDEX idx_projects_github ON projects(github_owner, github_repo, user_id);
```

---

## Row Level Security (RLS)

RLS is enabled on all tables. Users can only access their own data.

```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

-- Projects: users access their own
CREATE POLICY "Users can manage their own projects"
  ON projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Related tables: access via project ownership
CREATE POLICY "Users can access files for their projects"
  ON project_files FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can access analysis for their projects"
  ON analysis_results FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can access learning paths for their projects"
  ON learning_paths FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can access exercises for their projects"
  ON exercises FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
  );
```

---

## Supabase Auth Configuration

### GitHub OAuth Provider
Required settings in Supabase dashboard:
- Provider: GitHub
- Client ID + Client Secret from GitHub OAuth App
- Redirect URL: `https://[your-domain]/auth/callback`

### Auth Settings
- `scopes`: `"public_repo read:user"` — needed to list user's repos and get provider_token
- `persistSession`: true (default)
- `provider_token` stored in session — used for GitHub API calls with elevated rate limit

---

## TypeScript Types (from `types/database.ts`)

```typescript
export interface Project {
  id: string;
  user_id: string;
  repo_name: string;
  github_owner: string | null;
  github_repo: string | null;
  github_url: string | null;
  status: "pending" | "processing" | "complete" | "error";
  file_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  language: string | null;
  size: number;
  created_at: string;
}

export interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string | null;
  tech_stack: TechStack | null;
  architecture: ArchitectureInfo | null;
  key_files: KeyFile[] | null;
  created_at: string;
}

export interface LearningPath {
  id: string;
  project_id: string;
  skill_level: string | null;
  title: string | null;
  description: string | null;
  version: number;
  modules: LearningModule[] | null;    // V1
  skill_graph: {                        // V2
    modules: SkillModule[];
    nodes: SkillNode[];
    edges: SkillEdge[];
  } | null;
  gap_analysis: GapAnalysis | null;    // V2
  role: string | null;                 // V2
  created_at: string;
}

export interface Exercise {
  id: string;
  project_id: string;
  type: ExerciseType;
  difficulty: string | null;
  title: string;
  prompt: string;
  original_code: string | null;
  modified_code: string | null;
  expected_answer: string | null;
  hints: string[] | null;
  related_file: string | null;
  options: string[] | null;
  correct_option_index: number | null;
  explanation: string | null;
  created_at: string;
}

// Union type for type-safe DB operations
export type Database = {
  public: {
    Tables: {
      projects: { Row: Project; Insert: Omit<Project, "id" | "created_at" | "updated_at">; Update: Partial<Project> };
      project_files: { Row: ProjectFile; Insert: Omit<ProjectFile, "id" | "created_at">; Update: Partial<ProjectFile> };
      analysis_results: { Row: AnalysisResult; Insert: Omit<AnalysisResult, "id" | "created_at">; Update: Partial<AnalysisResult> };
      learning_paths: { Row: LearningPath; Insert: Omit<LearningPath, "id" | "created_at">; Update: Partial<LearningPath> };
      exercises: { Row: Exercise; Insert: Omit<Exercise, "id" | "created_at">; Update: Partial<Exercise> };
    };
  };
};
```

---

## DB Operations Summary (`lib/supabase/db.ts`)

### Save Flow (from `POST /api/projects/save`)
```
1. saveProject()          → INSERT into projects → returns projectId
2. updateProjectStatus()  → UPDATE projects SET status='processing'
3. saveProjectFiles()     → INSERT batch into project_files (max 500KB per file, truncated)
4. saveAnalysisResult()   → INSERT into analysis_results
5. saveLearningPath()     → INSERT into learning_paths (V1 or V2 format)
6. saveExercises()        → INSERT batch into exercises
7. updateProjectStatus()  → UPDATE projects SET status='complete'
```

### V1 vs V2 Storage Format
```typescript
// V1 save:
await supabase.from("learning_paths").insert({
  project_id: projectId,
  version: 1,
  modules: path.modules,  // LearningModule[]
  title: path.title,
  description: path.description,
  skill_level: skillLevel,
});

// V2 save:
await supabase.from("learning_paths").insert({
  project_id: projectId,
  version: 2,
  skill_graph: { modules: path.modules, nodes: path.nodes, edges: path.edges },
  gap_analysis: path.gapAnalysis,
  role: path.role,
  skill_level: skillLevel,
});
```

### Read with Transformation
```typescript
// dbRowToAnalysis(row) maps snake_case columns to camelCase AnalysisResult
// dbRowToExercise(row) handles legacy wrapped formats:
//   { items: [...] } → unwraps to array
//   { value: "..." } → unwraps string
```

---

## `.mcp.json` — MCP Server Config

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "<SUPABASE_ACCESS_TOKEN>"
      ]
    }
  }
}
```

Used for direct DB operations via Claude Code CLI during development.
