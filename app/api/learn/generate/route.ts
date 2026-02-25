import { NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/create-provider";
import { PROMPTS } from "@/lib/ai/prompts";
import { AI_MODELS } from "@/lib/constants";
import type { RepoFile } from "@/types/github";

export async function POST(request: Request) {
  try {
    const { techStack, skillLevel, files } = (await request.json()) as {
      techStack: string[];
      skillLevel: string;
      files: RepoFile[];
    };

    if (!techStack || techStack.length === 0) {
      return NextResponse.json(
        { error: "Tech stack is required" },
        { status: 400 }
      );
    }

    const ai = createAIProvider();

    // Create code examples from files for context
    const codeExamples = (files || [])
      .slice(0, 8)
      .map((f) => `// ${f.path}\n${f.content.slice(0, 500)}`)
      .join("\n\n");

    const result = await ai.generate({
      model: AI_MODELS.deep,
      messages: [
        {
          role: "user",
          content: PROMPTS.generateLearningPath(
            techStack,
            skillLevel || "beginner",
            codeExamples
          ),
        },
      ],
      responseFormat: "json",
      maxTokens: 16384,
    });

    let learningPath: Record<string, unknown>;
    try {
      learningPath = JSON.parse(result.content);
    } catch {
      console.error("Failed to parse learning path JSON, raw length:", result.content.length);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    // Add computed fields
    const modules = Array.isArray(learningPath.modules) ? learningPath.modules : [];
    const totalLessons = modules.reduce(
      (sum: number, m: { lessons?: unknown[] }) => sum + (m.lessons?.length ?? 0),
      0
    );

    return NextResponse.json({
      ...learningPath,
      skillLevel: skillLevel || "beginner",
      totalLessons,
      completedLessons: 0,
    });
  } catch (error) {
    console.error("Failed to generate learning path:", error);
    return NextResponse.json(
      { error: "Failed to generate learning path" },
      { status: 500 }
    );
  }
}
