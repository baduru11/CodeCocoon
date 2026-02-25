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
