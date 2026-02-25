import type { AIProvider } from "./provider";
import type { RepoFile } from "@/types/github";
import type {
  RoleProfile,
  LearningPathV2,
  SkillNode,
  SkillEdge,
  SkillModule,
  GapAnalysis,
  PlatformRecommendation,
  ConceptCategory,
} from "@/types/learning";
import type { TutorialData } from "@/types/tutorial";
import { AI_MODELS } from "@/lib/constants";
import { PROMPTS } from "./prompts";

// ─── Types for intermediate pipeline data ────────────────────────────

interface RawConcept {
  id: string;
  name: string;
  category: ConceptCategory;
  relevanceScore: number;
  moduleGroup: string;
  fileReferences: string[];
}

interface GraphData {
  id: string;
  prerequisites: string[];
  difficulty: number;
  estimatedMinutes: number;
}

interface LessonData {
  id: string;
  explanation: string;
  inYourCodebase: string;
  keyTakeaways: string[];
  tags: string[];
}

// ─── Validation ──────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function validateConcepts(raw: unknown): RawConcept[] {
  const obj = raw as Record<string, unknown>;
  const concepts = obj.concepts;
  if (!Array.isArray(concepts)) throw new Error("concepts must be an array");

  return concepts.map((c: Record<string, unknown>) => {
    if (!c.id || !c.name || !c.category)
      throw new Error("Concept missing id/name/category");
    return {
      id: String(c.id),
      name: String(c.name),
      category: (["language", "framework", "pattern", "tooling", "architecture", "library"].includes(String(c.category))
        ? String(c.category)
        : "framework") as ConceptCategory,
      relevanceScore: Number(c.relevanceScore ?? 0.5),
      moduleGroup: String(c.moduleGroup ?? "General"),
      fileReferences: Array.isArray(c.fileReferences)
        ? c.fileReferences.map(String)
        : [],
    };
  });
}

function validateGraph(
  raw: unknown,
  conceptIds: Set<string>
): { graph: GraphData[]; gapAnalysis: GapAnalysis } {
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.graph)) throw new Error("graph must be an array");
  if (!obj.gapAnalysis) throw new Error("gapAnalysis is required");

  const graph = (obj.graph as Record<string, unknown>[]).map((g) => {
    const id = String(g.id);
    const prerequisites = Array.isArray(g.prerequisites)
      ? g.prerequisites.map(String).filter((p) => conceptIds.has(p))
      : [];
    return {
      id,
      prerequisites,
      difficulty: Math.min(5, Math.max(1, Number(g.difficulty ?? 3))),
      estimatedMinutes: Math.min(
        120,
        Math.max(5, Number(g.estimatedMinutes ?? 30))
      ),
    };
  });

  const ga = obj.gapAnalysis as Record<string, unknown>;
  const gapAnalysis: GapAnalysis = {
    likelyKnown: Array.isArray(ga.likelyKnown)
      ? ga.likelyKnown.map(String)
      : [],
    focusAreas: Array.isArray(ga.focusAreas)
      ? ga.focusAreas.map(String)
      : [],
    summary: String(ga.summary ?? ""),
  };

  return { graph, gapAnalysis };
}

function validateLessons(
  raw: unknown,
  conceptIds: Set<string>
): LessonData[] {
  const obj = raw as Record<string, unknown>;
  const lessons = obj.lessons;
  if (!Array.isArray(lessons)) throw new Error("lessons must be an array");

  return lessons
    .filter((l: Record<string, unknown>) => conceptIds.has(String(l.id)))
    .map((l: Record<string, unknown>) => ({
      id: String(l.id),
      explanation: String(l.explanation ?? ""),
      inYourCodebase: String(l.inYourCodebase ?? ""),
      keyTakeaways: Array.isArray(l.keyTakeaways)
        ? l.keyTakeaways.map(String)
        : [],
      tags: Array.isArray(l.tags) ? l.tags.map(String) : [],
    }));
}

function validateResources(
  raw: unknown
): Record<string, PlatformRecommendation[]> {
  const obj = raw as Record<string, unknown>;
  const resources = obj.resources as Record<string, unknown[]>;
  if (!resources || typeof resources !== "object")
    throw new Error("resources must be an object");

  const result: Record<string, PlatformRecommendation[]> = {};
  for (const [conceptId, recs] of Object.entries(resources)) {
    if (!Array.isArray(recs)) continue;
    result[conceptId] = recs.map((item: unknown) => {
      const r = item as Record<string, unknown>;
      const url = String(r.url ?? "");
      const safeUrl = isValidUrl(url) ? url : "";
      return {
      platform: String(r.platform ?? ""),
      title: String(r.title ?? ""),
      url: safeUrl,
      type: String(r.type ?? "article") as PlatformRecommendation["type"],
      intent: String(r.intent ?? "start_here") as PlatformRecommendation["intent"],
      priceTier: String(
        r.priceTier ?? "free"
      ) as PlatformRecommendation["priceTier"],
      difficulty: String(r.difficulty ?? "beginner"),
      estimatedDuration: String(r.estimatedDuration ?? ""),
      whyThisResource: String(r.whyThisResource ?? ""),
    };
    });
  }
  return result;
}

// ─── Retry helper (same pattern as tutorial-pipeline.ts) ─────────────

/** Retry only on validation errors (bad JSON/output from LLM). Network/429
 *  errors are already handled by the Gemini-level retry + throttle. */
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

// ─── Module builder ──────────────────────────────────────────────────

const MODULE_COLORS = [
  "#6366f1",
  "#ec4899",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
  "#84cc16",
  "#f97316",
  "#14b8a6",
];

function buildModules(concepts: RawConcept[]): SkillModule[] {
  const groups = new Map<string, RawConcept[]>();
  for (const c of concepts) {
    const existing = groups.get(c.moduleGroup) ?? [];
    existing.push(c);
    groups.set(c.moduleGroup, existing);
  }

  const modules: SkillModule[] = [];
  let colorIdx = 0;
  for (const [group, groupConcepts] of groups) {
    const primaryCategory = groupConcepts[0]?.category ?? "framework";
    modules.push({
      id: group.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase(),
      title: group,
      description: `${groupConcepts.length} concepts covering ${group.toLowerCase()}`,
      category: primaryCategory,
      nodeIds: groupConcepts.map((c) => c.id),
      color: MODULE_COLORS[colorIdx % MODULE_COLORS.length],
    });
    colorIdx++;
  }
  return modules;
}

// ─── Main Pipeline ───────────────────────────────────────────────────

export async function runLearningPipeline(
  ai: AIProvider,
  files: RepoFile[],
  projectName: string,
  skillLevel: string,
  role: RoleProfile,
  tutorialData: TutorialData | null,
  send: (type: string, data: unknown) => void,
  checkAborted: () => void
): Promise<LearningPathV2> {
  // Build tech stack from file language field
  const techStack: string[] = [];
  const extCounts = new Map<string, number>();
  for (const f of files) {
    if (f.language)
      extCounts.set(f.language, (extCounts.get(f.language) ?? 0) + 1);
  }
  for (const [lang] of [...extCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)) {
    techStack.push(lang);
  }

  // ─── Step 1: Role-Based Concept Extraction ──────────────────────────

  send("step_start", "learning_concepts");
  send("status", "Extracting role-based concepts...");

  const codeExamples = !tutorialData
    ? files
        .slice(0, 5)
        .map((f) => {
          const lines = f.content.split("\n");
          const truncated =
            lines.length > 100
              ? lines.slice(0, 100).join("\n") + "\n..."
              : f.content;
          return `--- ${f.path} ---\n${truncated}`;
        })
        .join("\n\n")
    : undefined;

  const concepts = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: AI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.extractRoleConcepts(
            role,
            skillLevel,
            techStack,
            tutorialData?.abstractions,
            tutorialData?.relationships,
            codeExamples
          ),
        },
      ],
      responseFormat: "json",
      maxTokens: 8192,
    });
    return validateConcepts(JSON.parse(result.content));
  });

  send("learning_concepts", concepts);
  checkAborted();

  // ─── Step 2: Dependency Graph & Gap Analysis ────────────────────────

  send("step_start", "learning_graph");
  send("status", "Building skill dependency graph...");

  const conceptIds = new Set(concepts.map((c) => c.id));
  const analysisContext = tutorialData
    ? `Project: ${projectName}\nSummary: ${tutorialData.relationships.summary}`
    : undefined;

  const { graph, gapAnalysis } = await retryOnBadOutput(async () => {
    const result = await ai.generate({
      model: AI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.buildDependencyGraph(
            concepts.map((c) => ({
              id: c.id,
              name: c.name,
              category: c.category,
            })),
            skillLevel,
            analysisContext
          ),
        },
      ],
      responseFormat: "json",
      maxTokens: 8192,
    });
    return validateGraph(JSON.parse(result.content), conceptIds);
  });

  send("learning_graph", { graph, gapAnalysis });
  checkAborted();

  // ─── Step 3: Lesson Content Generation ──────────────────────────────

  send("step_start", "learning_lessons");
  send("status", "Generating lesson content...");

  let lessons: LessonData[];
  try {
    lessons = await retryOnBadOutput(async () => {
      const result = await ai.generate({
        model: AI_MODELS.deep,
        messages: [
          {
            role: "user",
            content: PROMPTS.generateLessonContent(
              concepts.map((c) => ({
                id: c.id,
                name: c.name,
                category: c.category,
                fileRefs: c.fileReferences,
              })),
              files,
              skillLevel
            ),
          },
        ],
        responseFormat: "json",
        maxTokens: 32768,
      });
      return validateLessons(JSON.parse(result.content), conceptIds);
    });
  } catch (error) {
    console.error(
      "Lesson generation failed, continuing with empty lessons:",
      error
    );
    lessons = concepts.map((c) => ({
      id: c.id,
      explanation: "",
      inYourCodebase: "",
      keyTakeaways: [],
      tags: [],
    }));
  }

  send("learning_lessons", lessons);
  checkAborted();

  // ─── Step 4: Resource Curation ──────────────────────────────────────

  send("step_start", "learning_resources");
  send("status", "Curating learning resources...");

  // Build lookup maps from graph and lesson data
  const graphMap = new Map(graph.map((g) => [g.id, g]));
  const lessonMap = new Map(lessons.map((l) => [l.id, l]));

  let resources: Record<string, PlatformRecommendation[]>;
  try {
    resources = await retryOnBadOutput(async () => {
      const result = await ai.generate({
        model: AI_MODELS.fast,
        messages: [
          {
            role: "user",
            content: PROMPTS.curateLearningResources(
              concepts.map((c) => ({
                id: c.id,
                name: c.name,
                tags: lessonMap.get(c.id)?.tags ?? [],
                difficulty: graphMap.get(c.id)?.difficulty ?? 3,
              })),
              skillLevel
            ),
          },
        ],
        responseFormat: "json",
        maxTokens: 32768,
      });
      return validateResources(JSON.parse(result.content));
    });
  } catch (error) {
    console.error(
      "Resource curation failed, continuing without resources:",
      error
    );
    resources = {};
  }

  send("learning_resources", resources);
  checkAborted();

  // ─── Assemble LearningPathV2 ───────────────────────────────────────

  const modules = buildModules(concepts);

  // Build edges from graph prerequisites
  const edges: SkillEdge[] = [];
  for (const g of graph) {
    for (const prereq of g.prerequisites) {
      edges.push({ from: prereq, to: g.id });
    }
  }

  // Build nodes by merging data from all pipeline steps
  const nodes: SkillNode[] = concepts.map((c) => {
    const g = graphMap.get(c.id);
    const l = lessonMap.get(c.id);
    const r = resources[c.id] ?? [];

    // Determine which module this concept belongs to
    const mod = modules.find((m) => m.nodeIds.includes(c.id));

    return {
      id: c.id,
      name: c.name,
      category: c.category,
      moduleId: mod?.id ?? "general",
      relevanceScore: c.relevanceScore,
      difficulty: g?.difficulty ?? 3,
      estimatedMinutes: g?.estimatedMinutes ?? 30,
      prerequisites: g?.prerequisites ?? [],
      explanation: l?.explanation ?? "",
      inYourCodebase: l?.inYourCodebase ?? "",
      keyTakeaways: l?.keyTakeaways ?? [],
      tags: l?.tags ?? [],
      resources: r,
      status: "ready" as const, // All start as ready; client computes locked/completed
    };
  });

  const totalMinutes = nodes.reduce((sum, n) => sum + n.estimatedMinutes, 0);

  const pathId = `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const learningPath: LearningPathV2 = {
    id: pathId,
    projectId: projectName,
    role,
    skillLevel,
    gapAnalysis,
    modules,
    nodes,
    edges,
    totalConcepts: nodes.length,
    completedConcepts: 0,
    estimatedTotalMinutes: totalMinutes,
  };

  return learningPath;
}
