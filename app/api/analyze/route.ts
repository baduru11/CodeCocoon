import { OpenRouterProvider } from "@/lib/ai/openrouter";
import { Schemas } from "@/lib/ai/schemas";
import { PROMPTS } from "@/lib/ai/prompts";
import { OPENROUTER_MODELS } from "@/lib/constants";
import type { RepoFile } from "@/types/github";

export async function POST(request: Request) {
  try {
    const { files } = (await request.json()) as { files: RepoFile[] };

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ai = new OpenRouterProvider();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (type: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
          );
        };

        try {
          // 1. Tech Stack
          send("status", "Detecting tech stack...");
          const techStackResult = await ai.generate({
            model: OPENROUTER_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.analyzeTechStack(files) }],
            responseFormat: "json",
            responseSchema: Schemas.techStack,
          });
          let techStack: unknown;
          try { techStack = JSON.parse(techStackResult.content); } catch { techStack = { languages: [], frameworks: [] }; }
          send("tech_stack", techStack);

          // 2. Architecture
          send("status", "Analyzing architecture...");
          const archResult = await ai.generate({
            model: OPENROUTER_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.analyzeArchitecture(files) }],
            responseFormat: "json",
            responseSchema: Schemas.architecture,
          });
          let architecture: unknown;
          try { architecture = JSON.parse(archResult.content); } catch { architecture = { pattern: "Unknown", description: "", layers: [], entryPoints: [] }; }
          send("architecture", architecture);

          // 3. Key Files
          send("status", "Identifying key files...");
          const keyFilesResult = await ai.generate({
            model: OPENROUTER_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.identifyKeyFiles(files) }],
            responseFormat: "json",
          });
          let keyFiles: unknown;
          try { keyFiles = JSON.parse(keyFilesResult.content); } catch { keyFiles = []; }
           send("key_files", keyFiles);

           // 4. Summary
          send("status", "Writing summary...");
          const summaryResult = await ai.generate({
            model: OPENROUTER_MODELS.fast,
            messages: [{ role: "user", content: PROMPTS.generateSummary(files) }],
          });
          send("summary", summaryResult.content);

           // Complete
           send("complete", {
             techStack,
             architecture,
             keyFiles,
             summary: summaryResult.content,
           });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Analysis failed";
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
    console.error("Analysis error:", error);
    return new Response(JSON.stringify({ error: "Analysis failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
