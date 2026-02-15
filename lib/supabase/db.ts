import type { SupabaseClient } from "@supabase/supabase-js";
import type { RepoFile } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import type { LearningPath } from "@/types/learning";
import type { Exercise } from "@/types/exercise";
import type { Project } from "@/types/database";

interface SaveProjectData {
  user_id: string;
  name: string;
  source_type: "github" | "upload";
  github_url?: string | null;
  github_owner?: string | null;
  github_repo?: string | null;
}

/**
 * Create a new project record.
 */
export async function saveProject(
  supabase: SupabaseClient,
  data: SaveProjectData
): Promise<string> {
  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      user_id: data.user_id,
      name: data.name,
      source_type: data.source_type,
      github_url: data.github_url ?? null,
      github_owner: data.github_owner ?? null,
      github_repo: data.github_repo ?? null,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to save project: ${error.message}`);
  }

  return project.id;
}

/**
 * Update a project's status.
 */
export async function updateProjectStatus(
  supabase: SupabaseClient,
  projectId: string,
  status: Project["status"]
): Promise<void> {
  const { error } = await supabase
    .from("projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (error) {
    throw new Error(`Failed to update project status: ${error.message}`);
  }
}

/**
 * Batch insert project files.
 */
export async function saveProjectFiles(
  supabase: SupabaseClient,
  projectId: string,
  files: RepoFile[]
): Promise<void> {
  const rows = files.map((file) => ({
    project_id: projectId,
    path: file.path,
    content: file.content,
    language: file.language,
    size_bytes: file.size,
  }));

  const { error } = await supabase.from("project_files").insert(rows);

  if (error) {
    throw new Error(`Failed to save project files: ${error.message}`);
  }

  // Update file count on the project
  await supabase
    .from("projects")
    .update({ file_count: files.length, updated_at: new Date().toISOString() })
    .eq("id", projectId);
}

/**
 * Save analysis result with JSONB fields.
 */
export async function saveAnalysisResult(
  supabase: SupabaseClient,
  projectId: string,
  analysis: AnalysisResult
): Promise<void> {
  const { error } = await supabase.from("analysis_results").insert({
    project_id: projectId,
    tech_stack: analysis.techStack,
    architecture: analysis.architecture,
    code_quality: analysis.codeQuality,
    key_files: analysis.keyFiles,
    summary: analysis.summary,
  });

  if (error) {
    throw new Error(`Failed to save analysis result: ${error.message}`);
  }
}

/**
 * Save a learning path with modules as JSONB.
 */
export async function saveLearningPath(
  supabase: SupabaseClient,
  projectId: string,
  skillLevel: string,
  path: LearningPath
): Promise<void> {
  const { error } = await supabase.from("learning_paths").insert({
    project_id: projectId,
    title: path.title,
    description: path.description,
    skill_level: skillLevel,
    modules: path.modules,
  });

  if (error) {
    throw new Error(`Failed to save learning path: ${error.message}`);
  }
}

/**
 * Batch insert exercises, mapping Exercise fields to DB columns.
 */
export async function saveExercises(
  supabase: SupabaseClient,
  projectId: string,
  exercises: Exercise[]
): Promise<void> {
  const rows = exercises.map((ex) => ({
    project_id: projectId,
    type: ex.type,
    difficulty: ex.difficulty,
    title: ex.title,
    prompt: ex.prompt,
    original_code: ex.originalCode || null,
    modified_code: ex.modifiedCode || null,
    expected_answer: ex.expectedAnswer ? { value: ex.expectedAnswer } : null,
    hints: ex.hints ? { items: ex.hints } : null,
    related_file: ex.relatedFile || null,
    // MCQ / output_prediction fields
    options: ex.options ? { items: ex.options } : null,
    correct_option_index: ex.correctOptionIndex ?? null,
    explanation: ex.explanation || null,
  }));

  const { error } = await supabase.from("exercises").insert(rows);

  if (error) {
    throw new Error(`Failed to save exercises: ${error.message}`);
  }
}

/**
 * Get all projects for the current user, with joined analysis results.
 */
export async function getUserProjects(
  supabase: SupabaseClient
): Promise<(Project & { analysis_results: { summary: string | null; tech_stack: Record<string, unknown> | null }[] })[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*, analysis_results(summary, tech_stack)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get user projects: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Find a duplicate project by GitHub owner and repo for the current user.
 */
export async function findDuplicateProject(
  supabase: SupabaseClient,
  githubOwner: string,
  githubRepo: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("github_owner", githubOwner)
    .eq("github_repo", githubRepo)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to check for duplicate project: ${error.message}`);
  }

  return data;
}

/**
 * Get a project with all related data: analysis, learning paths, and exercises.
 */
export async function getProjectWithAllData(
  supabase: SupabaseClient,
  projectId: string
): Promise<{
  project: Project;
  analysis: Record<string, unknown> | null;
  learningPaths: Record<string, unknown>[];
  exercises: Record<string, unknown>[];
} | null> {
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (projectError || !project) {
    return null;
  }

  const [analysisResult, pathsResult, exercisesResult] = await Promise.all([
    supabase
      .from("analysis_results")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("learning_paths")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    supabase
      .from("exercises")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true }),
  ]);

  return {
    project,
    analysis: analysisResult.data ?? null,
    learningPaths: pathsResult.data ?? [],
    exercises: exercisesResult.data ?? [],
  };
}
