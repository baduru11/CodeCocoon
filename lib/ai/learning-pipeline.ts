import type { AIProvider } from "./provider";
import type { RepoFile } from "@/types/github";
import type { TechStack } from "@/types/analysis";
import type { TutorialAbstraction, TutorialRelationships } from "@/types/tutorial";
import type {
  RoleProfile,
  LearningPathV2,
  SkillNode,
  SkillEdge,
  SkillModule,
  GapAnalysis,
  PlatformRecommendation,
  ConceptCategory,
  ResourceType,
  ResourceIntent,
  PriceTier,
} from "@/types/learning";
import { GEMINI_MODELS } from "@/lib/constants";
import { PROMPTS } from "./prompts";
import { GeminiSchemas } from "./gemini";

// ─── Types for raw LLM outputs ─────────────────────────────────────

interface RawConcept {
  name: string;
  category: string;
  relevanceScore: number;
  fileReferences: string[];
  moduleGroup: string;
}

interface RawGraphNode {
  index: number;
  prerequisites: number[];
  difficulty: number;
  estimatedMinutes: number;
}

interface RawLesson {
  conceptIndex: number;
  explanation: string;
  inYourCodebase: string;
  keyTakeaways: string[];
  tags: string[];
}

interface RawResource {
  conceptIndex: number;
  recommendations: {
    platform: string;
    title: string;
    url: string;
    type: string;
    intent: string;
    priceTier: string;
    difficulty: string;
    estimatedDuration: string;
    whyThisResource: string;
  }[];
}

// ─── Validation ─────────────────────────────────────────────────────

const VALID_CATEGORIES = new Set<ConceptCategory>([
  "language", "framework", "pattern", "tooling", "architecture", "library",
]);

const VALID_RESOURCE_TYPES = new Set<ResourceType>([
  "course", "video", "article", "interactive", "documentation",
]);

const VALID_INTENTS = new Set<ResourceIntent>([
  "start_here", "go_deeper", "quick_reference",
]);

const VALID_PRICE_TIERS = new Set<PriceTier>([
  "free", "paid", "subscription",
]);

function validateConcepts(raw: unknown): RawConcept[] {
  const obj = raw as { concepts?: unknown[] };
  if (!obj.concepts || !Array.isArray(obj.concepts)) {
    throw new Error("Concept extraction must return { concepts: [...] }");
  }
  if (obj.concepts.length < 5) {
    throw new Error(`Too few concepts: ${obj.concepts.length}, expected at least 5`);
  }
  return obj.concepts.map((item) => {
    const c = item as Record<string, unknown>;
    return {
    name: String(c.name || "").trim(),
    category: VALID_CATEGORIES.has(c.category as ConceptCategory)
      ? (c.category as string)
      : "framework",
    relevanceScore: Math.max(0, Math.min(1, Number(c.relevanceScore) || 0.5)),
    fileReferences: Array.isArray(c.fileReferences)
      ? c.fileReferences.map(String)
      : [],
    moduleGroup: String(c.moduleGroup || "General").trim(),
  };
  });
}

function validateGraph(
  raw: unknown,
  numConcepts: number
): { nodes: RawGraphNode[]; gapAnalysis: GapAnalysis } {
  const obj = raw as { nodes?: unknown[]; gapAnalysis?: Record<string, unknown> };
  if (!obj.nodes || !Array.isArray(obj.nodes)) {
    throw new Error("Dependency graph must return { nodes: [...] }");
  }
  if (!obj.gapAnalysis) {
    throw new Error("Dependency graph must include gapAnalysis");
  }

  const nodes = obj.nodes.map((item) => {
    const n = item as Record<string, unknown>;
    return {
      index: Number(n.index),
      prerequisites: (Array.isArray(n.prerequisites) ? n.prerequisites : [])
        .map(Number)
        .filter((i: number) => i >= 0 && i < numConcepts),
      difficulty: Math.max(1, Math.min(5, Number(n.difficulty) || 3)),
      estimatedMinutes: Math.max(5, Math.min(60, Number(n.estimatedMinutes) || 20)),
    };
  });

  const ga = obj.gapAnalysis;
  const gapAnalysis: GapAnalysis = {
    likelyKnown: Array.isArray(ga.likelyKnown)
      ? ga.likelyKnown.map(String)
      : [],
    focusAreas: Array.isArray(ga.focusAreas)
      ? ga.focusAreas.map(String)
      : [],
    summary: String(ga.summary || ""),
  };

  return { nodes, gapAnalysis };
}

function validateLessons(raw: unknown): RawLesson[] {
  const obj = raw as { lessons?: unknown[] };
  if (!obj.lessons || !Array.isArray(obj.lessons)) {
    throw new Error("Lesson content must return { lessons: [...] }");
  }
  return obj.lessons.map((item) => {
    const l = item as Record<string, unknown>;
    return {
      conceptIndex: Number(l.conceptIndex),
      explanation: String(l.explanation || ""),
      inYourCodebase: String(l.inYourCodebase || ""),
      keyTakeaways: Array.isArray(l.keyTakeaways)
        ? l.keyTakeaways.map(String)
        : [],
      tags: Array.isArray(l.tags) ? l.tags.map(String) : [],
    };
  });
}

function validateResources(raw: unknown): RawResource[] {
  const obj = raw as { resources?: unknown[] };
  if (!obj.resources || !Array.isArray(obj.resources)) {
    throw new Error("Resource curation must return { resources: [...] }");
  }
  return obj.resources.map((item) => {
    const r = item as Record<string, unknown>;
    return {
      conceptIndex: Number(r.conceptIndex),
      recommendations: (
        Array.isArray(r.recommendations) ? r.recommendations : []
      ).map((recItem) => {
        const rec = recItem as Record<string, unknown>;
        return {
          platform: String(rec.platform || ""),
          title: String(rec.title || ""),
          url: String(rec.url || ""),
          type: VALID_RESOURCE_TYPES.has(rec.type as ResourceType)
            ? String(rec.type)
            : "article",
          intent: VALID_INTENTS.has(rec.intent as ResourceIntent)
            ? String(rec.intent)
            : "start_here",
          priceTier: VALID_PRICE_TIERS.has(rec.priceTier as PriceTier)
            ? String(rec.priceTier)
            : "free",
          difficulty: String(rec.difficulty || "intermediate"),
          estimatedDuration: String(rec.estimatedDuration || ""),
          whyThisResource: String(rec.whyThisResource || ""),
        };
      }),
    };
  });
}

// ─── Helpers ────────────────────────────────────────────────────────

async function retryOnBadOutput<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.warn(
      "Learning pipeline validation failed, retrying once in 3s...",
      error instanceof Error ? error.message : error
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));
    return await fn();
  }
}

function buildAbstractionsSummary(
  abstractions: TutorialAbstraction[],
  relationships: TutorialRelationships
): string {
  const lines = abstractions.map(
    (a, i) => `${i + 1}. ${a.name}: ${a.description.slice(0, 200)}`
  );
  return `Project Summary: ${relationships.summary}\n\nCore Abstractions:\n${lines.join("\n")}`;
}

function formatCodeContextForPipeline(files: RepoFile[], maxFiles = 10): string {
  const MAX_LINES = 100;
  const MAX_CHARS = 60_000;
  let total = 0;
  const parts: string[] = [];

  for (const f of files.slice(0, maxFiles)) {
    if (total >= MAX_CHARS) break;
    const lines = f.content.split("\n");
    const truncated =
      lines.length > MAX_LINES
        ? lines.slice(0, MAX_LINES).join("\n") + `\n... (${lines.length - MAX_LINES} more lines)`
        : f.content;
    const chunk = `--- ${f.path} ---\n${truncated}`;
    parts.push(chunk);
    total += chunk.length;
  }

  return parts.join("\n\n");
}

const MODULE_COLORS = [
  "#6366F1", // indigo
  "#F59E0B", // amber
  "#10B981", // emerald
  "#EF4444", // red
  "#8B5CF6", // violet
  "#06B6D4", // cyan
  "#F97316", // orange
  "#EC4899", // pink
];

function generateConceptId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Assembly ───────────────────────────────────────────────────────

function assembleSkillTree(
  concepts: RawConcept[],
  graphNodes: RawGraphNode[],
  lessons: RawLesson[],
  resources: RawResource[],
  gapAnalysis: GapAnalysis,
  role: RoleProfile,
  skillLevel: string,
  projectId: string
): LearningPathV2 {
  // Build concept ID mapping
  const conceptIds = concepts.map((c) => generateConceptId(c.name));

  // Build module groups
  const moduleMap = new Map<string, string[]>();
  concepts.forEach((c, i) => {
    const group = c.moduleGroup;
    if (!moduleMap.has(group)) moduleMap.set(group, []);
    moduleMap.get(group)!.push(conceptIds[i]);
  });

  const modules: SkillModule[] = [...moduleMap.entries()].map(
    ([title, nodeIds], i) => {
      const firstConcept = concepts.find((c) => c.moduleGroup === title);
      return {
        id: `module-${i + 1}`,
        title,
        description: `Concepts related to ${title}`,
        category: (firstConcept?.category || "framework") as ConceptCategory,
        nodeIds,
        color: MODULE_COLORS[i % MODULE_COLORS.length],
      };
    }
  );

  // Build lesson lookup
  const lessonMap = new Map<number, RawLesson>();
  for (const l of lessons) {
    lessonMap.set(l.conceptIndex, l);
  }

  // Build resource lookup
  const resourceMap = new Map<number, PlatformRecommendation[]>();
  for (const r of resources) {
    resourceMap.set(
      r.conceptIndex,
      r.recommendations.map((rec) => ({
        platform: rec.platform,
        title: rec.title,
        url: rec.url,
        type: rec.type as ResourceType,
        intent: rec.intent as ResourceIntent,
        priceTier: rec.priceTier as PriceTier,
        difficulty: rec.difficulty,
        estimatedDuration: rec.estimatedDuration,
        whyThisResource: rec.whyThisResource,
      }))
    );
  }

  // Build graph node lookup
  const graphMap = new Map<number, RawGraphNode>();
  for (const gn of graphNodes) {
    graphMap.set(gn.index, gn);
  }

  // Build edges
  const edges: SkillEdge[] = [];
  for (const gn of graphNodes) {
    for (const prereq of gn.prerequisites) {
      if (prereq >= 0 && prereq < concepts.length) {
        edges.push({
          from: conceptIds[prereq],
          to: conceptIds[gn.index],
        });
      }
    }
  }

  // Find module ID for each concept
  const conceptModuleId = new Map<string, string>();
  for (const mod of modules) {
    for (const nodeId of mod.nodeIds) {
      conceptModuleId.set(nodeId, mod.id);
    }
  }

  // Build nodes — all start as "ready" (no lock system)
  const nodes: SkillNode[] = concepts.map((c, i) => {
    const id = conceptIds[i];
    const gn = graphMap.get(i);
    const lesson = lessonMap.get(i);
    const prereqIds = (gn?.prerequisites || []).map((p) => conceptIds[p]);

    return {
      id,
      name: c.name,
      category: c.category as ConceptCategory,
      moduleId: conceptModuleId.get(id) || modules[0]?.id || "module-1",
      relevanceScore: c.relevanceScore,
      difficulty: gn?.difficulty || 3,
      estimatedMinutes: gn?.estimatedMinutes || 20,
      prerequisites: prereqIds,
      explanation: lesson?.explanation || "",
      inYourCodebase: lesson?.inYourCodebase || "",
      keyTakeaways: lesson?.keyTakeaways || [],
      tags: lesson?.tags || [],
      resources: resourceMap.get(i) || [],
      status: "ready" as SkillNode["status"],
    };
  });

  const totalMinutes = nodes.reduce((sum, n) => sum + n.estimatedMinutes, 0);
  const completedCount = 0;

  return {
    id: `lp-${Date.now()}`,
    projectId,
    role,
    skillLevel,
    gapAnalysis,
    modules,
    nodes,
    edges,
    totalConcepts: nodes.length,
    completedConcepts: completedCount,
    estimatedTotalMinutes: totalMinutes,
  };
}

// ─── Main Pipeline ──────────────────────────────────────────────────

export interface LearningPipelineInput {
  role: RoleProfile;
  skillLevel: string;
  techStack: TechStack;
  files: RepoFile[];
  projectId: string;
  // From tutorial pipeline (integrated mode)
  abstractions?: TutorialAbstraction[];
  relationships?: TutorialRelationships;
  // From analysis
  summary?: string;
  architectureJson?: string;
}

export async function runLearningPipeline(
  ai: AIProvider,
  input: LearningPipelineInput,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void
): Promise<LearningPathV2> {
  const {
    role,
    skillLevel,
    techStack,
    files,
    projectId,
    abstractions,
    relationships,
    summary,
    architectureJson,
  } = input;

  const techStackList = [
    ...techStack.languages,
    ...techStack.frameworks,
  ];

  // Build context
  const abstractionsSummary =
    abstractions && relationships
      ? buildAbstractionsSummary(abstractions, relationships)
      : summary || "No prior analysis available.";

  const codeContext = formatCodeContextForPipeline(files);

  const codebasePatterns = [
    summary || "",
    architectureJson ? `Architecture: ${architectureJson}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  // ── Step 1: Concept Extraction (fast model) ───────────────────────
  send("step_start", "learning_concepts");
  send("status", "Extracting role-based concepts...");

  const concepts = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: GEMINI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.extractRoleConcepts({
            roleLabel: role.displayName,
            roleDescription:
              role.custom || `${role.displayName} role`,
            skillLevel,
            techStack: techStackList,
            abstractionsSummary,
            codeContext,
          }),
        },
      ],
      responseFormat: "json",
      responseSchema: GeminiSchemas.conceptExtraction,
      maxTokens: 8192,
    });
    return validateConcepts(JSON.parse(result.content));
  });

  send("learning_concepts", concepts);
  checkAborted();

  // ── Step 2: Dependency Graph (fast model) ──────────────────────────
  send("step_start", "learning_graph");
  send("status", "Building skill dependency graph...");

  const { nodes: graphNodes, gapAnalysis } = await retryOnBadOutput(
    async () => {
      const result = await ai.generate({
        model: GEMINI_MODELS.fast,
        messages: [
          {
            role: "user",
            content: PROMPTS.buildDependencyGraph({
              concepts: concepts.map((c) => ({
                name: c.name,
                category: c.category,
                relevanceScore: c.relevanceScore,
                moduleGroup: c.moduleGroup,
              })),
              skillLevel,
              codebasePatterns,
            }),
          },
        ],
        responseFormat: "json",
        responseSchema: GeminiSchemas.dependencyGraph,
        maxTokens: 8192,
      });
      return validateGraph(JSON.parse(result.content), concepts.length);
    }
  );

  send("learning_graph", { graphNodes, gapAnalysis });
  checkAborted();

  // ── Step 3: Lesson Content (deep model) ────────────────────────────
  send("step_start", "learning_lessons");
  send("status", "Generating lesson content...");

  const lessons = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: GEMINI_MODELS.deep,
      messages: [
        {
          role: "user",
          content: PROMPTS.generateLessonContent({
            concepts: concepts.map((c) => ({
              name: c.name,
              category: c.category,
              fileReferences: c.fileReferences,
              moduleGroup: c.moduleGroup,
            })),
            skillLevel,
            codeContext,
          }),
        },
      ],
      responseFormat: "json",
      responseSchema: GeminiSchemas.lessonContent,
      maxTokens: 16384,
    });
    return validateLessons(JSON.parse(result.content));
  });

  send("learning_lessons", lessons);
  checkAborted();

  // ── Step 4: Resource Curation (fast model) ─────────────────────────
  send("step_start", "learning_resources");
  send("status", "Curating learning resources...");

  // Merge tags from lessons into concepts for resource matching
  const conceptsWithTags = concepts.map((c, i) => {
    const lesson = lessons.find((l) => l.conceptIndex === i);
    const graphNode = graphNodes.find((n) => n.index === i);
    return {
      name: c.name,
      tags: lesson?.tags || [c.name.toLowerCase()],
      difficulty: graphNode?.difficulty || 3,
    };
  });

  const resources = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: GEMINI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.curateResources({
            concepts: conceptsWithTags,
            skillLevel,
          }),
        },
      ],
      responseFormat: "json",
      responseSchema: GeminiSchemas.resourceCuration,
      maxTokens: 16384,
    });
    return validateResources(JSON.parse(result.content));
  });

  send("learning_resources", resources);
  checkAborted();

  // ── Assemble final LearningPathV2 ─────────────────────────────────

  const learningPath = assembleSkillTree(
    concepts,
    graphNodes,
    lessons,
    resources,
    gapAnalysis,
    role,
    skillLevel,
    projectId
  );

  send("learning_path", learningPath);

  return learningPath;
}
