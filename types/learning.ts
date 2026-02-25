// =============================================================================
// Learning Path Types
// =============================================================================
// V1 types are preserved for backward compatibility with existing data.
// V2 types power the redesigned skill-graph learning experience.
// =============================================================================

// -----------------------------------------------------------------------------
// V1 Types (backward compatibility)
// -----------------------------------------------------------------------------

export interface Resource {
  title: string;
  url: string;
  type: "documentation" | "tutorial" | "video" | "article" | "interactive";
  source: string; // e.g., "MDN", "freeCodeCamp", "official docs"
}

export interface LearningPathV1Lesson {
  id: string;
  title: string;
  description: string;
  keyConceptsFromCode: string; // How this lesson relates to their codebase
  resources: Resource[];
  completed?: boolean;
}

export interface LearningPathV1Module {
  id: string;
  title: string;
  description: string;
  lessons: LearningPathV1Lesson[];
  techStack: string; // Which tech stack item this covers
}

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

// -----------------------------------------------------------------------------
// V2 Types — Role
// -----------------------------------------------------------------------------

export type RolePreset =
  | "frontend_dev"
  | "backend_dev"
  | "fullstack_dev"
  | "devops_infra"
  | "product_manager"
  | "qa_testing";

export interface RoleProfile {
  preset: RolePreset | null;
  custom: string | null;
  displayName: string;
}

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

// -----------------------------------------------------------------------------
// V2 Types — Skill Graph
// -----------------------------------------------------------------------------

export type ConceptCategory =
  | "language"
  | "framework"
  | "pattern"
  | "tooling"
  | "architecture"
  | "library";

export interface SkillNode {
  id: string;
  name: string;
  category: ConceptCategory;
  moduleId: string;
  relevanceScore: number;
  difficulty: number;
  estimatedMinutes: number;
  prerequisites: string[];
  explanation: string;
  inYourCodebase: string;
  keyTakeaways: string[];
  tags: string[];
  resources: PlatformRecommendation[];
  status: "locked" | "ready" | "in_progress" | "completed";
}

export interface SkillEdge {
  from: string;
  to: string;
}

export interface SkillModule {
  id: string;
  title: string;
  description: string;
  category: ConceptCategory;
  nodeIds: string[];
  color: string;
}

// -----------------------------------------------------------------------------
// V2 Types — Resources
// -----------------------------------------------------------------------------

export type ResourceType =
  | "course"
  | "video"
  | "article"
  | "interactive"
  | "documentation";

export type PriceTier = "free" | "paid" | "subscription";

export type ResourceIntent = "start_here" | "go_deeper" | "quick_reference";

export interface PlatformRecommendation {
  platform: string;
  title: string;
  url: string;
  type: ResourceType;
  intent: ResourceIntent;
  priceTier: PriceTier;
  difficulty: string;
  estimatedDuration: string;
  whyThisResource: string;
}

// -----------------------------------------------------------------------------
// V2 Types — Gap Analysis
// -----------------------------------------------------------------------------

export interface GapAnalysis {
  likelyKnown: string[];
  focusAreas: string[];
  summary: string;
}

// -----------------------------------------------------------------------------
// V2 Types — Top-level Container
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Union Type + Type Guard
// -----------------------------------------------------------------------------

export type LearningPath = LearningPathV1 | LearningPathV2;

export function isV2LearningPath(lp: LearningPath): lp is LearningPathV2 {
  return "role" in lp && "nodes" in lp;
}
