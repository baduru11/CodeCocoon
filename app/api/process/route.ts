import { createAIProvider } from "@/lib/ai/create-provider";
import { PROMPTS } from "@/lib/ai/prompts";
import { AI_MODELS } from "@/lib/constants";
import { fetchContentForFiles } from "@/lib/github/fetcher";
import { getLanguageStats } from "@/lib/github/filter";
import { isValidGitHubName } from "@/lib/github/parser";
import { createClient } from "@/lib/supabase/server";
import { runTutorialPipeline } from "@/lib/ai/tutorial-pipeline";
import { runLearningPipeline } from "@/lib/ai/learning-pipeline";
import type { RoleProfile } from "@/types/learning";
import type { RepoFile } from "@/types/github";

interface ProcessRequest {
  owner: string;
  repo: string;
  selectedFiles: { path: string; sha: string; size: number }[];
  skillLevel: string;
  /** Pre-uploaded file contents — when present, skip GitHub fetch */
  uploadedFiles?: RepoFile[];
  role?: RoleProfile;
}

export async function POST(request: Request) {
  try {
    const { owner, repo, selectedFiles, skillLevel, uploadedFiles, role } =
      (await request.json()) as ProcessRequest;

    const isUpload = !!uploadedFiles?.length;

    if (!isUpload && (!owner || !repo || !selectedFiles?.length)) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: owner, repo, selectedFiles" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isUpload && (!isValidGitHubName(owner) || !isValidGitHubName(repo))) {
      return new Response(
        JSON.stringify({ error: "Invalid owner or repo name" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get auth token from Supabase session (not needed for uploads)
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

    const ai = createAIProvider();
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

          const files: RepoFile[] = isUpload
            ? uploadedFiles!
            : await fetchContentForFiles(owner, repo, selectedFiles, { token });

          const projectName = isUpload
            ? (repo || "Uploaded Project")
            : `${owner}/${repo}`;

          const projectData = {
            files,
            repoName: projectName,
            fileCount: files.length,
            languages: getLanguageStats(
              files.map((f) => ({ path: f.path, size: f.size }))
            ),
            totalSize: files.reduce((s, f) => s + f.size, 0),
          };

          send("files_fetched", projectData);

          checkAborted();

          // ── All AI calls run sequentially to stay within Gemini rate limits ──

          // Step 2: Tech stack analysis
          send("step_start", "tech_stack");
          send("status", "Analyzing tech stack...");

          const techStackResult = await ai.generate({
            model: AI_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.analyzeTechStack(files) }],
            responseFormat: "json",
          });

          let techStack: { languages?: string[]; frameworks?: string[] };
          try {
            techStack = JSON.parse(techStackResult.content);
          } catch {
            techStack = { languages: [], frameworks: [] };
          }
          send("tech_stack", techStack);
          checkAborted();

          // Step 3: Architecture analysis
          send("step_start", "architecture");
          send("status", "Analyzing architecture...");

          const archResult = await ai.generate({
            model: AI_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.analyzeArchitecture(files) }],
            responseFormat: "json",
          });

          let architecture: unknown;
          try {
            architecture = JSON.parse(archResult.content);
          } catch {
            architecture = { pattern: "Unknown", description: "", layers: [], entryPoints: [] };
          }
          send("architecture", architecture);
          checkAborted();

          // Step 4: Key files
          send("step_start", "key_files");
          send("status", "Identifying key files...");

          const keyFilesResult = await ai.generate({
            model: AI_MODELS.fast,
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
          send("status", "Generating tutorial content...");
          const tutorialData = await runTutorialPipeline(ai, files, projectName, send, checkAborted);

          // Backward-compat: send summary string extracted from tutorial
          send("summary", tutorialData.relationships.summary);
          checkAborted();

          // Step 6: Learning path pipeline (sequential internally)
          send("step_start", "exercises");
          send("status", "Generating learning path...");

          const defaultRole: RoleProfile = {
            preset: "fullstack_dev",
            custom: null,
            displayName: "Full-Stack Developer",
          };

          const exerciseTypes = [
            "error_injection",
            "code_recreation",
            "code_explanation",
            "mcq",
            "output_prediction",
            "parsons",
            "error_message",
          ];

          // Learning path pipeline first (4 sequential steps internally)
          const learningPath = await runLearningPipeline(
            ai,
            files,
            projectName,
            skillLevel || "beginner",
            role || defaultRole,
            tutorialData,
            send,
            checkAborted
          );

          // Send the final assembled learning path
          send("learning_path", learningPath);

          checkAborted();

          // Exercises run after learning pipeline to avoid deep model contention
          send("status", "Generating exercises...");
          const exercisesResult = await ai.generate({
            model: AI_MODELS.deep,
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
