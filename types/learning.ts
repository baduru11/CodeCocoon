// --- Role ---

export interface RoleProfile {
  preset: RolePreset | null; // Selected preset, null if custom
  custom: string | null; // Freeform description, null if preset
  displayName: string; // Resolved display name for UI
}

export type RolePreset =
  | "frontend_dev"
  | "backend_dev"
  | "fullstack_dev"
  | "devops_infra"
  | "product_manager"
  | "qa_testing";

export const ROLE_PRESETS: Record<
  RolePreset,
  { label: string; description: string; icon: string }
> = {
  frontend_dev: {
    label: "Frontend Developer",
    description:
      "New to the frontend codebase — components, styling, state management",
    icon: "Monitor",
  },
  backend_dev: {
    label: "Backend Developer",
    description:
      "Focused on APIs, database, server logic, and infrastructure",
    icon: "Server",
  },
  fullstack_dev: {
    label: "Full-Stack Developer",
    description:
      "Need to understand the full picture — frontend to backend",
    icon: "Layers",
  },
  devops_infra: {
    label: "DevOps / Infrastructure",
    description:
      "Focused on deployment, CI/CD, configs, and infrastructure code",
    icon: "Container",
  },
  product_manager: {
    label: "Product Manager",
    description:
      "Want to understand the architecture and tech decisions, not write code",
    icon: "BarChart3",
  },
  qa_testing: {
    label: "QA / Testing",
    description:
      "Focused on test coverage, testing patterns, and quality assurance",
    icon: "ShieldCheck",
  },
};

// --- Skill Graph ---

export type ConceptCategory =
  | "language"
  | "framework"
  | "pattern"
  | "tooling"
  | "architecture"
  | "library";

export interface SkillNode {
  id: string; // Unique identifier (e.g., "react-hooks")
  name: string; // Display name (e.g., "React Hooks")
  category: ConceptCategory;
  moduleId: string; // Which module group this belongs to
  relevanceScore: number; // 0-1, how relevant to the user's role
  difficulty: number; // 1-5
  estimatedMinutes: number; // Estimated learning time
  prerequisites: string[]; // IDs of prerequisite SkillNodes

  // Lesson content (substantive but not exhaustive)
  explanation: string; // 100-200 words: what it is, why it matters, analogy
  inYourCodebase: string; // 2-3 sentences: specific files/patterns where this appears
  keyTakeaways: string[]; // 2-3 bullet points
  tags: string[]; // For resource matching (e.g., ["react-hooks", "state"])

  // Resources
  resources: PlatformRecommendation[];

  // Progress (client-side)
  status: "locked" | "ready" | "in_progress" | "completed";
}

export interface SkillEdge {
  from: string; // SkillNode ID (prerequisite)
  to: string; // SkillNode ID (depends on `from`)
}

// --- Modules (grouping layer) ---

export interface SkillModule {
  id: string;
  title: string; // e.g., "React Fundamentals"
  description: string;
  category: ConceptCategory; // Primary category
  nodeIds: string[]; // SkillNode IDs in this module
  color: string; // Accent color for visual grouping
}

// --- Resources (partnership surface) ---

export type ResourceType =
  | "course"
  | "video"
  | "article"
  | "interactive"
  | "documentation";
export type PriceTier = "free" | "paid" | "subscription";
export type ResourceIntent = "start_here" | "go_deeper" | "quick_reference";

export interface PlatformRecommendation {
  platform: string; // e.g., "Coursera", "freeCodeCamp", "MDN"
  title: string; // Course/article title
  url: string;
  type: ResourceType;
  intent: ResourceIntent;
  priceTier: PriceTier;
  difficulty: string; // "beginner", "intermediate", "advanced"
  estimatedDuration: string; // e.g., "2 hours", "4 weeks"
  whyThisResource: string; // One-line contextual recommendation
}

// --- Gap Analysis ---

export interface GapAnalysis {
  likelyKnown: string[]; // Concepts the user probably already knows
  focusAreas: string[]; // Concepts the user should prioritize
  summary: string; // 2-3 sentence personalized summary
}

// --- Top-level container ---

export interface LearningPathV2 {
  id: string;
  projectId: string;
  role: RoleProfile;
  skillLevel: string;
  gapAnalysis: GapAnalysis;
  modules: SkillModule[];
  nodes: SkillNode[];
  edges: SkillEdge[];
  totalConcepts: number;
  completedConcepts: number;
  estimatedTotalMinutes: number;
}

// --- Backward compat ---
// Keep the old LearningPath type as LearningPathV1 for old sessions

export interface LearningPathV1 {
  id: string;
  projectId: string;
  title: string;
  description: string;
  skillLevel: string;
  modules: LearningPathV1Module[];
  totalLessons: number;
  completedLessons: number;
}

export interface LearningPathV1Module {
  id: string;
  title: string;
  description: string;
  techStack: string;
  lessons: LearningPathV1Lesson[];
}

export interface LearningPathV1Lesson {
  id: string;
  title: string;
  description: string;
  keyConceptsFromCode: string;
  resources: { title: string; url: string; type: string; source: string }[];
  completed?: boolean;
}

/** Union type — check for `role` field to distinguish versions */
export type LearningPath = LearningPathV1 | LearningPathV2;

export function isV2LearningPath(lp: LearningPath): lp is LearningPathV2 {
  return "role" in lp && "nodes" in lp;
}
