import { OpenRouterProvider } from "@/lib/ai/openrouter";
import { OPENROUTER_MODELS } from "@/lib/constants";
import { RAGService, formatChunksForPrompt } from "@/lib/rag";

export const runtime = "nodejs";

interface ChatRequest {
  projectId: string;
  message: string;
  history: { role: "user" | "assistant"; content: string }[];
  context: {
    repoName: string;
    techStack?: { languages: string[]; frameworks: string[]; databases: string[]; tools: string[]; styling: string[] };
    architecturePattern?: string;
    skillLevel: string;
    roleLabel: string;
    conceptNames?: string[];
  };
}

export async function POST(request: Request) {
  try {
    const { projectId, message, history, context } = (await request.json()) as ChatRequest;

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!projectId?.trim()) {
      return new Response(JSON.stringify({ error: "Project ID is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (message.length > 2000) {
      return new Response(JSON.stringify({ error: "Message too long (max 2000 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Limit history to prevent context window overflow
    const trimmedHistory = (history || []).slice(-20);

    const ai = new OpenRouterProvider();
    const rag = new RAGService();
    const encoder = new TextEncoder();

    // Query RAG for relevant code chunks
    let ragContext = "";
    let referencedFiles: string[] = [];
    try {
      const chunks = await rag.query(projectId, message, 6);
      if (chunks && chunks.length > 0) {
        ragContext = formatChunksForPrompt(chunks);
        referencedFiles = [...new Set(chunks.map((c) => c.file))];
      }
    } catch {
      // RAG unavailable — proceed with general knowledge only
    }

    // Build system prompt with project context
    const techStackStr = context.techStack
      ? [...context.techStack.languages, ...context.techStack.frameworks].join(", ")
      : "unknown";

    const conceptsStr = context.conceptNames?.length
      ? `\nLEARNING PATH CONCEPTS: ${context.conceptNames.join(", ")}`
      : "";

    const systemPrompt = `You are a helpful coding tutor assisting a student who is learning about their codebase.

PROJECT: ${context.repoName}
TECH STACK: ${techStackStr}
ARCHITECTURE: ${context.architecturePattern || "unknown"}
STUDENT SKILL LEVEL: ${context.skillLevel}
STUDENT ROLE: ${context.roleLabel}${conceptsStr}

${ragContext ? `RELEVANT CODE FROM THEIR CODEBASE:\n${ragContext}` : "No specific code context available — answer based on general knowledge of the tech stack."}

INSTRUCTIONS:
- Answer questions about their specific codebase when code context is available
- When no relevant code is found, provide general guidance about the technologies
- Adapt your explanations to the student's skill level (${context.skillLevel})
- Reference specific files and line numbers when discussing code
- Be concise but thorough — aim for 2-4 paragraphs unless a longer explanation is needed
- Use code examples from their codebase when possible
- If you're unsure about something specific to their codebase, say so rather than guessing`;

    // Build message history for the LLM
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...trimmedHistory.map((msg) => ({
        role: msg.role === "user" ? "user" as const : "model" as const,
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send referenced files first
          if (referencedFiles.length > 0) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "references", data: referencedFiles })}\n\n`)
            );
          }

          const generator = ai.generateStream({
            model: OPENROUTER_MODELS.deep,
            messages,
            temperature: 0.7,
            maxTokens: 4096,
          });

          for await (const chunk of generator) {
            if (chunk.content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "content", data: chunk.content })}\n\n`)
              );
            }
            if (chunk.done) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
              );
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Chat failed";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", data: msg })}\n\n`)
          );
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
    console.error("Chat route error:", error);
    return new Response(JSON.stringify({ error: "Chat failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
