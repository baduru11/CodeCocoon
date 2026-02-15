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
