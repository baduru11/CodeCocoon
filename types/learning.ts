export interface Resource {
  title: string;
  url: string;
  type: "documentation" | "tutorial" | "video" | "article" | "interactive";
  source: string; // e.g., "MDN", "freeCodeCamp", "official docs"
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  keyConceptsFromCode: string; // How this lesson relates to their codebase
  resources: Resource[];
  completed?: boolean;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  techStack: string; // Which tech stack item this covers
}

export interface LearningPath {
  id: string;
  projectId: string;
  title: string;
  description: string;
  skillLevel: string;
  modules: Module[];
  totalLessons: number;
  completedLessons: number;
}
