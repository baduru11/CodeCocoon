import type { FetchRepoResult } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import type { LearningPath } from "@/types/learning";
import type { Exercise } from "@/types/exercise";

export interface ProjectSession {
  id: string;
  repoName: string;
  repoUrl: string;
  analyzedAt: string;
  skillLevel: string;
  projectData: FetchRepoResult;
  analysisData: AnalysisResult;
  learningPath: LearningPath;
  exercises: Exercise[];
}
