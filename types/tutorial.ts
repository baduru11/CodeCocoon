export interface TutorialAbstraction {
  name: string;
  description: string; // ~100 words, beginner-friendly with analogy
  fileIndices: number[]; // indices into the fetched files array
}

export interface TutorialRelationship {
  from: number; // index into abstractions array
  to: number; // index into abstractions array
  label: string; // e.g. "Manages", "Provides config"
}

export interface TutorialRelationships {
  summary: string; // markdown project overview
  details: TutorialRelationship[];
}

export interface TutorialChapter {
  index: number; // abstraction index this chapter covers
  name: string; // chapter title (abstraction name)
  filename: string; // e.g. "01_query_processing" (for cross-links)
  content: string; // full markdown with mermaid diagrams
}

export interface TutorialData {
  abstractions: TutorialAbstraction[];
  relationships: TutorialRelationships;
  chapterOrder: number[]; // abstraction indices in pedagogical order
  chapters: TutorialChapter[];
}
