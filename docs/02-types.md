# CodeCocoon — TypeScript Types

All types live in `types/`. They are imported with `@/types/...`.

---

## `types/github.ts`

```typescript
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface RepoFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}

// Why a file was filtered
export type FilterReason =
  | "too_large"
  | "binary_file"
  | "ignored_directory"
  | "unsupported_extension"
  | "non_file";

// Summary of filtering for UI display
export interface FilterSummary {
  totalScanned: number;
  totalIncluded: number;
  totalExcluded: number;
  excludedByReason: Record<FilterReason, number>;
}

export interface FetchRepoResult {
  files: RepoFile[];
  repoName: string;
  fileCount: number;
  languages: Record<string, number>;
  totalSize: number;
}

// New types for the configure/preview flow
export interface TreePreviewFile {
  path: string;
  sha: string;
  size: number;
  language: string;
  excluded: boolean;
  filterReason?: FilterReason;
  filterDetails?: string;
}

export interface FetchTreeResult {
  files: TreePreviewFile[];
  excludedFiles: TreePreviewFile[];
  repoName: string;
  owner: string;
  repo: string;
  totalFiles: number;
  totalExcludedFiles: number;
  totalSize: number;
  languages: Record<string, number>;
  filterSummary: FilterSummary;
}

export interface ProcessConfig {
  owner: string;
  repo: string;
  selectedFiles: TreePreviewFile[];
  skillLevel: "beginner" | "intermediate" | "advanced";
  repoName: string;
  role?: {
    preset: string | null;
    custom: string | null;
  };
  /** True when files come from local upload (not GitHub). */
  isUpload?: boolean;
}
```

---

## `types/analysis.ts`

```typescript
export interface TechStack {
  languages: string[];
  frameworks: string[];
  databases: string[];
  tools: string[];
  styling: string[];
}

export interface ArchitectureInfo {
  pattern: string;
  description: string;
  layers: {
    name: string;
    description: string;
    files: string[];
  }[];
  entryPoints: string[];
}

export interface CodeQuality {
  score: number; // 0-100
  issues: string[];
  strengths: string[];
}

export interface KeyFile {
  path: string;
  role: string;
  description: string;
}

import type { TutorialData } from "./tutorial";

export interface AnalysisResult {
  id?: string;
  projectId?: string;
  techStack: TechStack;
  architecture: ArchitectureInfo;
  codeQuality?: CodeQuality;
  keyFiles: KeyFile[];
  summary: string;
  tutorial?: TutorialData;
}

export interface AnalysisStreamEvent {
  type:
    | "status"
    | "step_start"
    | "tech_stack"
    | "architecture"
    | "key_files"
    | "summary"
    | "files_fetched"
    | "tutorial_abstractions"
    | "tutorial_relationships"
    | "tutorial_order"
    | "tutorial_chapter"
    | "learning_concepts"
    | "learning_graph"
    | "learning_lessons"
    | "learning_resources"
    | "learning_path"
    | "exercises"
    | "complete"
    | "error";
  data: unknown;
}
```

---

## `types/tutorial.ts`

```typescript
export interface TutorialAbstraction {
  name: string;
  description: string; // ~100 words, beginner-friendly with analogy
  fileIndices: number[]; // indices into the fetched files array
}

export interface TutorialRelationship {
  from: number; // index into abstractions array
  to: number;   // index into abstractions array
  label: string; // e.g. "Manages", "Provides config"
}

export interface TutorialRelationships {
  summary: string; // markdown project overview
  details: TutorialRelationship[];
}

export interface TutorialChapter {
  index: number;   // abstraction index this chapter covers
  name: string;    // chapter title (abstraction name)
  filename: string; // e.g. "01_query_processing" (for cross-links)
  content: string; // full markdown with mermaid diagrams
}

export interface TutorialData {
  abstractions: TutorialAbstraction[];
  relationships: TutorialRelationships;
  chapterOrder: number[]; // abstraction indices in pedagogical order
  chapters: TutorialChapter[];
}
```

---

## `types/learning.ts`

```typescript
// --- Role ---

export interface RoleProfile {
  preset: RolePreset | null;
  custom: string | null;
  displayName: string;
}

export type RolePreset =
  | "frontend_dev"
  | "backend_dev"
  | "fullstack_dev"
  | "devops_infra"
  | "product_manager"
  | "qa_testing";

export const ROLE_PRESETS: Record<
  RolePreset,
  { label: string; description: string; icon: string }
> = {
  frontend_dev: {
    label: "Frontend Developer",
    description: "New to the frontend codebase — components, styling, state management",
    icon: "Monitor",
  },
  backend_dev: {
    label: "Backend Developer",
    description: "Focused on APIs, database, server logic, and infrastructure",
    icon: "Server",
  },
  fullstack_dev: {
    label: "Full-Stack Developer",
    description: "Need to understand the full picture — frontend to backend",
    icon: "Layers",
  },
  devops_infra: {
    label: "DevOps / Infrastructure",
    description: "Focused on deployment, CI/CD, configs, and infrastructure code",
    icon: "Container",
  },
  product_manager: {
    label: "Product Manager",
    description: "Want to understand the architecture and tech decisions, not write code",
    icon: "BarChart3",
  },
  qa_testing: {
    label: "QA / Testing",
    description: "Focused on test coverage, testing patterns, and quality assurance",
    icon: "ShieldCheck",
  },
};

// --- Skill Graph ---

export type ConceptCategory =
  | "language"
  | "framework"
  | "pattern"
  | "tooling"
  | "architecture"
  | "library";

export interface SkillNode {
  id: string;
  name: string;
  category: ConceptCategory;
  moduleId: string;
  relevanceScore: number; // 0-1
  difficulty: number;     // 1-5
  estimatedMinutes: number;
  prerequisites: string[]; // IDs of prerequisite SkillNodes

  // Lesson content
  explanation: string;      // 100-200 words
  inYourCodebase: string;   // 2-3 sentences, specific files
  keyTakeaways: string[];   // 2-3 bullet points
  tags: string[];           // For resource matching

  // Resources
  resources: PlatformRecommendation[];

  // Progress (client-side)
  status: "locked" | "ready" | "in_progress" | "completed";
}

export interface SkillEdge {
  from: string; // SkillNode ID (prerequisite)
  to: string;   // SkillNode ID (depends on `from`)
}

export interface SkillModule {
  id: string;
  title: string;
  description: string;
  category: ConceptCategory;
  nodeIds: string[];
  color: string; // Accent color for visual grouping
}

// --- Resources ---

export type ResourceType = "course" | "video" | "article" | "interactive" | "documentation";
export type PriceTier = "free" | "paid" | "subscription";
export type ResourceIntent = "start_here" | "go_deeper" | "quick_reference";

export interface PlatformRecommendation {
  platform: string;
  title: string;
  url: string;
  type: ResourceType;
  intent: ResourceIntent;
  priceTier: PriceTier;
  difficulty: string;
  estimatedDuration: string;
  whyThisResource: string;
}

// --- Gap Analysis ---

export interface GapAnalysis {
  likelyKnown: string[];
  focusAreas: string[];
  summary: string;
}

// --- Top-level container (V2) ---

export interface LearningPathV2 {
  id: string;
  projectId: string;
  role: RoleProfile;
  skillLevel: string;
  gapAnalysis: GapAnalysis;
  modules: SkillModule[];
  nodes: SkillNode[];
  edges: SkillEdge[];
  totalConcepts: number;
  completedConcepts: number;
  estimatedTotalMinutes: number;
}

// --- Backward compat (V1) ---

export interface LearningPathV1 {
  id: string;
  projectId: string;
  title: string;
  description: string;
  skillLevel: string;
  modules: LearningPathV1Module[];
  totalLessons: number;
  completedLessons: number;
}

export interface LearningPathV1Module {
  id: string;
  title: string;
  description: string;
  techStack: string;
  lessons: LearningPathV1Lesson[];
}

export interface LearningPathV1Lesson {
  id: string;
  title: string;
  description: string;
  keyConceptsFromCode: string;
  resources: { title: string; url: string; type: string; source: string }[];
  completed?: boolean;
}

/** Union type — check for `role` field to distinguish versions */
export type LearningPath = LearningPathV1 | LearningPathV2;

export function isV2LearningPath(lp: LearningPath): lp is LearningPathV2 {
  return "role" in lp && "nodes" in lp;
}
```

---

## `types/exercise.ts`

```typescript
export type ExerciseType =
  | "error_injection"
  | "code_recreation"
  | "code_explanation"
  | "mcq"
  | "output_prediction"
  | "parsons"
  | "error_message";

export interface Exercise {
  id: string;
  projectId: string;
  type: ExerciseType;
  difficulty: "beginner" | "intermediate" | "advanced";
  title: string;
  prompt: string;
  originalCode: string;
  modifiedCode?: string; // buggy code, blanked code, shuffled lines JSON, error message text
  expectedAnswer: string;
  hints: string[];
  relatedFile: string;

  // MCQ / output_prediction only
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
}

export interface ExerciseAttempt {
  id?: string;
  exerciseId: string;
  userAnswer: string;
  isCorrect: boolean;
  feedback: string;
  completedAt: string;
}
```

---

## `types/assessment.ts`

```typescript
export type SkillLevel = "beginner" | "intermediate" | "advanced";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  topic: string;
  difficulty: SkillLevel;
  explanation: string;
}

export interface QuizAnswer {
  questionId: string;
  selectedAnswer: number;
  isCorrect: boolean;
}

export interface AssessmentResult {
  id?: string;
  projectId?: string;
  questions: QuizQuestion[];
  answers: QuizAnswer[];
  score: number; // 0-100
  skillLevel: SkillLevel;
  topicBreakdown: {
    topic: string;
    correct: number;
    total: number;
  }[];
}
```

---

## `types/project-session.ts`

```typescript
import type { FetchRepoResult } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import type { LearningPath, RoleProfile } from "@/types/learning";
import type { Exercise } from "@/types/exercise";

export interface ProjectSession {
  id: string;
  repoName: string;
  repoUrl: string;
  analyzedAt: string;
  skillLevel: string;
  role?: RoleProfile;
  projectData: FetchRepoResult;
  analysisData: AnalysisResult;
  learningPath: LearningPath;
  exercises: Exercise[];
}
```

---

## `types/database.ts`

```typescript
import type { ExerciseType } from "./exercise";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface Profile {
  id: string;
  github_username: string | null;
  avatar_url: string | null;
  skill_level: "beginner" | "intermediate" | "advanced" | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string | null;
  name: string;
  source_type: "github" | "upload";
  github_url: string | null;
  github_owner: string | null;
  github_repo: string | null;
  file_count: number;
  status: "pending" | "fetching" | "analyzing" | "complete" | "error";
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  path: string;
  content: string | null;
  language: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface AnalysisResultRow {
  id: string;
  project_id: string;
  tech_stack: Json | null;
  architecture: Json | null;
  code_quality: Json | null;
  key_files: Json | null;
  summary: string | null;
  created_at: string;
}

export interface AssessmentRow {
  id: string;
  user_id: string | null;
  project_id: string | null;
  questions: Json;
  answers: Json | null;
  score: number | null;
  skill_level: "beginner" | "intermediate" | "advanced" | null;
  completed_at: string | null;
  created_at: string;
}

export interface LearningPathRow {
  id: string;
  project_id: string;
  assessment_id: string | null;
  title: string;
  description: string | null;
  skill_level: string;
  modules: Json;
  created_at: string;
}

export interface LearningProgressRow {
  id: string;
  user_id: string;
  learning_path_id: string;
  module_index: number;
  lesson_index: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface ExerciseRow {
  id: string;
  project_id: string;
  type: ExerciseType;
  difficulty: string;
  title: string | null;
  prompt: string;
  original_code: string | null;
  modified_code: string | null;
  expected_answer: string | null;
  hints: string[] | null;
  options: string[] | null;
  correct_option_index: number | null;
  explanation: string | null;
  related_file: string | null;
  // Legacy columns
  flashcard_front: string | null;
  flashcard_back: string | null;
  buggy_code: string | null;
  solution_code: string | null;
  test_cases: Json | null;
  created_at: string;
}

export interface ExerciseAttemptRow {
  id: string;
  user_id: string;
  exercise_id: string;
  user_answer: string | null;
  is_correct: boolean | null;
  feedback: string | null;
  completed_at: string;
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "created_at" | "updated_at">;
        Update: Partial<Omit<Profile, "id" | "created_at">>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, "id" | "created_at" | "updated_at" | "file_count" | "status">;
        Update: Partial<Omit<Project, "id" | "created_at">>;
      };
      project_files: {
        Row: ProjectFile;
        Insert: Omit<ProjectFile, "id" | "created_at">;
        Update: Partial<Omit<ProjectFile, "id" | "created_at">>;
      };
      analysis_results: {
        Row: AnalysisResultRow;
        Insert: Omit<AnalysisResultRow, "id" | "created_at">;
        Update: Partial<Omit<AnalysisResultRow, "id" | "created_at">>;
      };
      assessments: {
        Row: AssessmentRow;
        Insert: Omit<AssessmentRow, "id" | "created_at">;
        Update: Partial<Omit<AssessmentRow, "id" | "created_at">>;
      };
      learning_paths: {
        Row: LearningPathRow;
        Insert: Omit<LearningPathRow, "id" | "created_at">;
        Update: Partial<Omit<LearningPathRow, "id" | "created_at">>;
      };
      learning_progress: {
        Row: LearningProgressRow;
        Insert: Omit<LearningProgressRow, "id" | "created_at">;
        Update: Partial<Omit<LearningProgressRow, "id" | "created_at">>;
      };
      exercises: {
        Row: ExerciseRow;
        Insert: Omit<ExerciseRow, "id" | "created_at">;
        Update: Partial<Omit<ExerciseRow, "id" | "created_at">>;
      };
      exercise_attempts: {
        Row: ExerciseAttemptRow;
        Insert: Omit<ExerciseAttemptRow, "id" | "completed_at">;
        Update: Partial<Omit<ExerciseAttemptRow, "id" | "completed_at">>;
      };
    };
  };
};
```
