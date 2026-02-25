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
    // Learning path pipeline events
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
