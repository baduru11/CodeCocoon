import { GeminiProvider, GeminiSchemas } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";
import { fetchContentForFiles } from "@/lib/github/fetcher";
import { getLanguageStats } from "@/lib/github/filter";
import { isValidGitHubName } from "@/lib/github/parser";
import { createClient } from "@/lib/supabase/server";
import { runTutorialPipeline } from "@/lib/ai/tutorial-pipeline";
import type { RepoFile } from "@/types/github";

interface ProcessRequest {
  owner: string;
  repo: string;
  selectedFiles: { path: string; sha: string; size: number }[];
  skillLevel: string;
}

export async function POST(request: Request) {
  try {
    const { owner, repo, selectedFiles, skillLevel } =
      (await request.json()) as ProcessRequest;

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

    // Get auth token from Supabase session
    let token: string | undefined;
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
          // Step 1: Fetch file contents
          send("status", "Fetching file contents...");
          send("step_start", "files_fetched");

          const files: RepoFile[] = await fetchContentForFiles(
            owner,
            repo,
            selectedFiles,
            { token }
          );

          const projectData = {
            files,
            repoName: `${owner}/${repo}`,
            fileCount: files.length,
            languages: getLanguageStats(
              files.map((f) => ({ path: f.path, size: f.size }))
            ),
            totalSize: files.reduce((s, f) => s + f.size, 0),
          };

          send("files_fetched", projectData);

          checkAborted();

          // Steps 2+: Analysis (parallel) + Tutorial pipeline (sequential) run concurrently
          send("step_start", "tech_stack");
          send("step_start", "architecture");
          send("step_start", "key_files");
          send("status", "Analyzing codebase...");

          const projectName = `${owner}/${repo}`;

          // Analysis + tutorial pipeline run concurrently; the Gemini
          // throttle in lib/ai/gemini.ts handles per-model rate limiting.
          const [analysisResults, tutorialData] = await Promise.all([
            Promise.all([
              ai.generate({
                model: GEMINI_MODELS.fast,
                messages: [{ role: "user", content: PROMPTS.analyzeTechStack(files) }],
                responseFormat: "json",
                responseSchema: GeminiSchemas.techStack,
              }),
              ai.generate({
                model: GEMINI_MODELS.fast,
                messages: [{ role: "user", content: PROMPTS.analyzeArchitecture(files) }],
                responseFormat: "json",
                responseSchema: GeminiSchemas.architecture,
              }),
              ai.generate({
                model: GEMINI_MODELS.fast,
                messages: [{ role: "user", content: PROMPTS.identifyKeyFiles(files) }],
                responseFormat: "json",
              }),
            ]),
            runTutorialPipeline(ai, files, projectName, send, checkAborted),
          ]);

          const [techStackResult, archResult, keyFilesResult] = analysisResults;

          let techStack: { languages?: string[]; frameworks?: string[] };
          try {
            techStack = JSON.parse(techStackResult.content);
          } catch {
            techStack = { languages: [], frameworks: [] };
          }
          send("tech_stack", techStack);

          let architecture: unknown;
          try {
            architecture = JSON.parse(archResult.content);
          } catch {
            architecture = { pattern: "Unknown", description: "", layers: [], entryPoints: [] };
          }
          send("architecture", architecture);

          let keyFiles: unknown;
          try {
            keyFiles = JSON.parse(keyFilesResult.content);
          } catch {
            keyFiles = [];
          }
          send("key_files", keyFiles);

          // Backward-compat: send summary string extracted from tutorial
          send("summary", tutorialData.relationships.summary);

          checkAborted();

          // Learning path + exercises in parallel (both use deep model)
          send("step_start", "learning_path");
          send("step_start", "exercises");
          send("status", "Generating learning path & exercises...");

          const techStackList = [
            ...(techStack.languages || []),
            ...(techStack.frameworks || []),
          ];
          const codeExamples = files
            .slice(0, 3)
            .map((f) => {
              const lines = f.content.split("\n");
              const truncated = lines.length > 150
                ? lines.slice(0, 150).join("\n") + "\n... (truncated)"
                : f.content;
              return `--- ${f.path} ---\n${truncated}`;
            })
            .join("\n\n");

          const analysisContext = `Summary: ${tutorialData.relationships.summary}\nArchitecture: ${JSON.stringify(architecture)}`;
          const learningPathPrompt = PROMPTS.generateLearningPathWithContext(
            techStackList,
            skillLevel || "beginner",
            codeExamples,
            analysisContext
          );

          const exerciseTypes = [
            "error_injection",
            "code_recreation",
            "code_explanation",
            "mcq",
            "output_prediction",
            "parsons",
            "error_message",
          ];

          const [learningPathResult, exercisesResult] = await Promise.all([
            ai.generate({
              model: GEMINI_MODELS.deep,
              messages: [{ role: "user", content: learningPathPrompt }],
              responseFormat: "json",
              responseSchema: GeminiSchemas.learningPath,
              maxTokens: 32768,
            }),
            ai.generate({
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
            }),
          ]);

          let learningPath: unknown;
          try {
            learningPath = JSON.parse(learningPathResult.content);
          } catch (parseErr) {
            console.error("Failed to parse learning path JSON:", parseErr, "Raw content length:", learningPathResult.content.length);
            learningPath = { title: "", description: "", modules: [] };
          }
          send("learning_path", learningPath);

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
