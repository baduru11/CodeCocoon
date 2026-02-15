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
  modifiedCode?: string; // Multi-use: buggy code (error_injection), blanks (code_recreation), shuffled lines JSON (parsons), error message text (error_message)
  expectedAnswer: string;
  hints: string[];
  relatedFile: string; // Which file from their codebase this relates to

  // MCQ / output_prediction fields
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
