import type { ExerciseType } from "./exercise";

// Generic JSON type for Supabase JSONB columns
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
  // Legacy columns from removed exercise types (flashcard, ide_debugging)
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
