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

export interface AnalysisResult {
  id?: string;
  projectId?: string;
  techStack: TechStack;
  architecture: ArchitectureInfo;
  codeQuality?: CodeQuality;
  keyFiles: KeyFile[];
  summary: string;
}

export interface AnalysisStreamEvent {
  type: "status" | "tech_stack" | "architecture" | "key_files" | "summary" | "complete" | "error";
  data: unknown;
}
