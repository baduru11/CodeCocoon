export const runtime = "nodejs";

import { OpenRouterProvider } from "@/lib/ai/openrouter";
import { Schemas } from "@/lib/ai/schemas";
import { PROMPTS } from "@/lib/ai/prompts";
import { OPENROUTER_MODELS } from "@/lib/constants";
import { fetchContentForFiles } from "@/lib/github/fetcher";
import { getLanguageStats } from "@/lib/github/filter";
import { isValidGitHubName } from "@/lib/github/parser";
import { createClient } from "@/lib/supabase/server";
import { runTutorialPipeline } from "@/lib/ai/tutorial-pipeline";
import { runLearningPipeline } from "@/lib/ai/learning-pipeline";
import { RAGService, formatChunksForPrompt } from "@/lib/rag";
import { ROLE_PRESETS } from "@/types/learning";
import type { RoleProfile, RolePreset, LearningPathV2 } from "@/types/learning";
import type { RepoFile } from "@/types/github";
import type { TechStack } from "@/types/analysis";
import type { TutorialData } from "@/types/tutorial";

interface ProcessRequest {
  owner: string;
  repo: string;
  selectedFiles: { path: string; sha: string; size: number }[];
  skillLevel: string;
  role?: {
    preset: string | null;
    custom: string | null;
  };
  /** Pre-fetched file contents from local upload (skips GitHub fetch). */
  uploadedFiles?: RepoFile[];
}

function resolveRole(input?: ProcessRequest["role"]): RoleProfile {
  if (!input) {
    return {
      preset: "fullstack_dev",
      custom: null,
      displayName: ROLE_PRESETS.fullstack_dev.label,
    };
  }

  if (input.preset && input.preset in ROLE_PRESETS) {
    const preset = input.preset as RolePreset;
    return {
      preset,
      custom: null,
      displayName: ROLE_PRESETS[preset].label,
    };
  }

  if (input.custom) {
    return {
      preset: null,
      custom: input.custom,
      displayName: input.custom,
    };
  }

  return {
    preset: "fullstack_dev",
    custom: null,
    displayName: ROLE_PRESETS.fullstack_dev.label,
  };
}

// ─── Step Executor ───────────────────────────────────────────────────

function createStepExecutor(
  send: (type: string, data: unknown) => void,
  checkAborted: () => void
) {
  const results = new Map<string, unknown>();
  const resolvers = new Map<string, () => void>();
  const promises = new Map<string, Promise<void>>();

  function waitFor(name: string): Promise<void> {
    if (results.has(name)) return Promise.resolve();
    if (!promises.has(name)) {
      promises.set(
        name,
        new Promise<void>((resolve) => {
          resolvers.set(name, resolve);
        })
      );
    }
    return promises.get(name)!;
  }

  function resolve(name: string): void {
    const resolver = resolvers.get(name);
    if (resolver) resolver();
  }

  async function runStep<T>(
    name: string,
    deps: string[],
    fn: () => Promise<T>
  ): Promise<T> {
    await Promise.all(deps.map((d) => waitFor(d)));
    checkAborted();
    send("step_start", name);
    const result = await fn();
    results.set(name, result);
    resolve(name);
    return result;
  }

  function getResult<T>(name: string): T {
    return results.get(name) as T;
  }

  return { runStep, getResult };
}

// ─── Route Handler ───────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { owner, repo, selectedFiles, skillLevel, role: roleInput, uploadedFiles } =
      (await request.json()) as ProcessRequest;

    const isUpload = !!uploadedFiles?.length;

    if (!isUpload) {
      if (!owner || !repo || !selectedFiles?.length) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: owner, repo, selectedFiles" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      if (!isValidGitHubName(owner) || !isValidGitHubName(repo)) {
        return new Response(
          JSON.stringify({ error: "Invalid owner or repo name" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    const role = resolveRole(roleInput);

    // Get auth token from Supabase session (only needed for GitHub fetch)
    let token: string | undefined;
    if (!isUpload) {
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (supabaseUrl && supabaseKey && !supabaseUrl.includes("placeholder")) {
          const supabase = await createClient();
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.provider_token && session.provider_token.trim()) {
            token = session.provider_token;
          }
        }
      } catch {
        // Anonymous access — fetcher.ts will use unauthenticated Octokit
      }
    }

    const ai = new OpenRouterProvider();
    const encoder = new TextEncoder();
    const signal = request.signal;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        };

        const checkAborted = () => {
          if (signal.aborted) throw new Error("Client disconnected");
        };

        try {
          // Step 1: Fetch file contents (or use uploaded files)
          send("status", isUpload ? "Preparing uploaded files..." : "Fetching file contents...");
          send("step_start", "files_fetched");

          let files: RepoFile[];

          if (isUpload && uploadedFiles) {
            // Upload mode: use pre-fetched files, filter to selected paths
            const selectedPaths = new Set(selectedFiles.map((f) => f.path));
            files = selectedPaths.size > 0
              ? uploadedFiles.filter((f) => selectedPaths.has(f.path))
              : uploadedFiles;
          } else {
            files = await fetchContentForFiles(
              owner,
              repo,
              selectedFiles,
              { token }
            );
          }

          const repoName = isUpload ? (repo || "Uploaded Project") : `${owner}/${repo}`;
          // Unique RAG project ID — includes a hash of selected file paths
          // to disambiguate re-analyses and uploads with the same name
          const fileHash = files
            .map((f) => f.path)
            .sort()
            .join("|")
            .split("")
            .reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0)
            .toString(36);
          const ragProjectId = `${repoName}:${fileHash}`;

          const projectData = {
            files,
            repoName,
            fileCount: files.length,
            languages: getLanguageStats(
              files.map((f) => ({ path: f.path, size: f.size }))
            ),
            totalSize: files.reduce((s, f) => s + f.size, 0),
          };

          send("files_fetched", projectData);

          checkAborted();

          // Step 1.5: RAG indexing
          const rag = new RAGService();
          send("step_start", "indexing");
          send("status", "Indexing codebase for smart retrieval...");
          try {
            await rag.indexRepo(ragProjectId, files);
          } catch (error) {
            console.warn("RAG indexing failed, falling back to truncation:", error);
            // Continue without RAG — all steps have fallback behavior
          }
          send("indexing", { indexed: true });
          checkAborted();

          const projectName = repoName;

          // ── Parallel Pipeline Execution ─────────────────────────────

          const { runStep, getResult } = createStepExecutor(send, checkAborted);

          await Promise.all([
            // ── Wave 1: Independent steps (all need only files) ──────

            runStep("tech_stack", [], async () => {
              send("status", "Detecting tech stack...");
              // RAG query for config/dependency files
              let ragContext: string | undefined;
              const chunks = await rag.query(
                ragProjectId,
                "Project configuration files declaring dependencies, frameworks, and build tools",
                10
              );
              if (chunks) ragContext = formatChunksForPrompt(chunks);

              const result = await ai.generate({
                model: OPENROUTER_MODELS.fast,
                messages: [{ role: "user", content: PROMPTS.analyzeTechStack(files, ragContext) }],
                responseFormat: "json",
                responseSchema: Schemas.techStack,
              });
              let techStack: TechStack;
              try {
                techStack = JSON.parse(result.content);
              } catch {
                techStack = { languages: [], frameworks: [], databases: [], tools: [], styling: [] };
              }
              send("tech_stack", techStack);
              return techStack;
            }),

            runStep("architecture", [], async () => {
              send("status", "Analyzing architecture...");
              const chunks = await rag.query(
                ragProjectId,
                "Main entry points, routing definitions, middleware, and application structure",
                10
              );
              const ragContext = chunks ? formatChunksForPrompt(chunks) : undefined;

              const result = await ai.generate({
                model: OPENROUTER_MODELS.fast,
                messages: [{ role: "user", content: PROMPTS.analyzeArchitecture(files, ragContext) }],
                responseFormat: "json",
                responseSchema: Schemas.architecture,
              });
              let architecture: unknown;
              try {
                architecture = JSON.parse(result.content);
              } catch {
                architecture = { pattern: "Unknown", description: "", layers: [], entryPoints: [] };
              }
              send("architecture", architecture);
              return architecture;
            }),

            runStep("key_files", [], async () => {
              send("status", "Identifying key files...");
              const result = await ai.generate({
                model: OPENROUTER_MODELS.fast,
                messages: [{ role: "user", content: PROMPTS.identifyKeyFiles(files) }],
                responseFormat: "json",
              });
              let keyFiles: unknown;
              try {
                keyFiles = JSON.parse(result.content);
              } catch {
                keyFiles = [];
              }
              send("key_files", keyFiles);
              return keyFiles;
            }),

            runStep("abstractions", [], async () => {
              send("status", "Identifying core concepts...");
              const tutorialData = await runTutorialPipeline(
                ai,
                files,
                projectName,
                send,
                checkAborted,
                rag
              );
              send("summary", tutorialData.relationships.summary);
              return tutorialData;
            }),

            // ── Steps with dependencies ──────────────────────────────

            runStep("concepts", ["abstractions", "tech_stack"], async () => {
              send("status", "Extracting role-based concepts...");
              const tutorialData = getResult<TutorialData>("abstractions");
              const techStack = getResult<TechStack>("tech_stack");

              const learningPath = await runLearningPipeline(
                ai,
                {
                  role,
                  skillLevel: skillLevel || "beginner",
                  techStack,
                  files,
                  projectId: repoName,
                  abstractions: tutorialData.abstractions,
                  relationships: tutorialData.relationships,
                  summary: tutorialData.relationships.summary,
                  architectureJson: JSON.stringify(getResult("architecture")),
                },
                send,
                checkAborted,
                rag
              );
              return learningPath;
            }),

            runStep("exercises", ["concepts"], async () => {
              send("status", "Generating exercises...");
              const learningPath = getResult<LearningPathV2>("concepts");
              const concepts = learningPath.nodes.map((n) => ({
                name: n.name,
                category: n.category,
              }));

              // RAG query for exercise-relevant code
              const conceptNames = concepts
                .slice(0, 5)
                .map((c) => c.name)
                .join(", ");
              const chunks = await rag.query(
                ragProjectId,
                `Code implementing ${conceptNames} with functions and logic suitable for coding exercises`,
                10
              );
              const ragContext = chunks ? formatChunksForPrompt(chunks) : undefined;

              const exerciseTypes = [
                "error_injection",
                "code_recreation",
                "code_explanation",
                "mcq",
                "output_prediction",
                "parsons",
                "error_message",
              ];

              const prompt = ragContext
                ? PROMPTS.generateExercisesWithConcepts(
                    ragContext,
                    skillLevel || "beginner",
                    exerciseTypes,
                    concepts,
                    role.displayName
                  )
                : PROMPTS.generateExercises(
                    files,
                    skillLevel || "beginner",
                    exerciseTypes
                  );

              const exercisesResult = await ai.generate({
                model: OPENROUTER_MODELS.deep,
                messages: [{ role: "user", content: prompt }],
                responseFormat: "json",
                responseSchema: Schemas.exercises,
                maxTokens: 32768,
              });

              let exercises: unknown;
              try {
                const parsed = JSON.parse(exercisesResult.content);
                exercises = Array.isArray(parsed) ? parsed : parsed.exercises || [];
              } catch (e) {
                console.error("Failed to parse exercises:", e);
                exercises = [];
              }
              send("exercises", exercises);
              return exercises;
            }),
          ]);

          // Gather all results
          const tutorialData = getResult<TutorialData>("abstractions");
          const techStack = getResult<TechStack>("tech_stack");
          const architecture = getResult("architecture");
          const keyFiles = getResult("key_files");
          const learningPath = getResult<LearningPathV2>("concepts");
          const exercises = getResult("exercises");

          // Complete — send aggregated result
          send("complete", {
            projectData,
            ragProjectId,
            analysis: {
              techStack,
              architecture,
              keyFiles,
              summary: tutorialData.relationships.summary,
              tutorial: tutorialData,
            },
            learningPath,
            exercises,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Processing failed";
          console.error("Process pipeline error:", error);
          send("error", { message });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Process route error:", error);
    return new Response(
      JSON.stringify({ error: "Processing failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
