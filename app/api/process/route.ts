import { GeminiProvider, GeminiSchemas } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";
import { fetchContentForFiles } from "@/lib/github/fetcher";
import { getLanguageStats } from "@/lib/github/filter";
import { isValidGitHubName } from "@/lib/github/parser";
import { createClient } from "@/lib/supabase/server";
import { runTutorialPipeline } from "@/lib/ai/tutorial-pipeline";
import { runLearningPipeline } from "@/lib/ai/learning-pipeline";
import { ROLE_PRESETS } from "@/types/learning";
import type { RoleProfile, RolePreset } from "@/types/learning";
import type { RepoFile } from "@/types/github";
import type { TechStack } from "@/types/analysis";

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

    const ai = new GeminiProvider();
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

          // Steps 2-4: Analysis (sequential to avoid rate limits)
          const projectName = repoName;

          send("step_start", "tech_stack");
          send("status", "Detecting tech stack...");
          const techStackResult = await ai.generate({
            model: GEMINI_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.analyzeTechStack(files) }],
            responseFormat: "json",
            responseSchema: GeminiSchemas.techStack,
          });
          let techStack: TechStack;
          try {
            techStack = JSON.parse(techStackResult.content);
          } catch {
            techStack = { languages: [], frameworks: [], databases: [], tools: [], styling: [] };
          }
          send("tech_stack", techStack);
          checkAborted();

          send("step_start", "architecture");
          send("status", "Analyzing architecture...");
          const archResult = await ai.generate({
            model: GEMINI_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.analyzeArchitecture(files) }],
            responseFormat: "json",
            responseSchema: GeminiSchemas.architecture,
          });
          let architecture: unknown;
          try {
            architecture = JSON.parse(archResult.content);
          } catch {
            architecture = { pattern: "Unknown", description: "", layers: [], entryPoints: [] };
          }
          send("architecture", architecture);
          checkAborted();

          send("step_start", "key_files");
          send("status", "Identifying key files...");
          const keyFilesResult = await ai.generate({
            model: GEMINI_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.identifyKeyFiles(files) }],
            responseFormat: "json",
          });
          let keyFiles: unknown;
          try {
            keyFiles = JSON.parse(keyFilesResult.content);
          } catch {
            keyFiles = [];
          }
          send("key_files", keyFiles);
          checkAborted();

          // Step 5: Tutorial pipeline (sequential internally)
          send("status", "Generating tutorial...");
          const tutorialData = await runTutorialPipeline(ai, files, projectName, send, checkAborted);
          send("summary", tutorialData.relationships.summary);
          checkAborted();

          // Step 6: Learning path pipeline (sequential internally, 4 steps)
          send("status", "Building learning path...");
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
              architectureJson: JSON.stringify(architecture),
            },
            send,
            checkAborted
          );
          checkAborted();

          // Step 7: Exercises (single call)
          send("step_start", "exercises");
          send("status", "Generating exercises...");
          const exerciseTypes = [
            "error_injection",
            "code_recreation",
            "code_explanation",
            "mcq",
            "output_prediction",
            "parsons",
            "error_message",
          ];
          const exercisesResult = await ai.generate({
            model: GEMINI_MODELS.deep,
            messages: [
              {
                role: "user",
                content: PROMPTS.generateExercises(
                  files,
                  skillLevel || "beginner",
                  exerciseTypes
                ),
              },
            ],
            responseFormat: "json",
            responseSchema: GeminiSchemas.exercises,
            maxTokens: 32768,
          });
          let exercises: unknown;
          try {
            const exercisesParsed = JSON.parse(exercisesResult.content);
            exercises = Array.isArray(exercisesParsed)
              ? exercisesParsed
              : exercisesParsed.exercises || [];
          } catch (parseErr) {
            console.error("Failed to parse exercises JSON:", parseErr, "Raw content length:", exercisesResult.content.length);
            exercises = [];
          }
          send("exercises", exercises);

          // Complete — send aggregated result
          send("complete", {
            projectData,
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
