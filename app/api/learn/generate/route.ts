import { NextResponse } from "next/server";
import { GeminiProvider, GeminiSchemas } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";
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

    const ai = new GeminiProvider();

    // Create code examples from files for context
    const codeExamples = files
      .slice(0, 8)
      .map((f) => `// ${f.path}\n${f.content.slice(0, 500)}`)
      .join("\n\n");

    const result = await ai.generate({
      model: GEMINI_MODELS.deep,
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
      responseSchema: GeminiSchemas.learningPath,
      maxTokens: 16384,
    });

    const learningPath = JSON.parse(result.content);

    // Add computed fields
    const totalLessons = learningPath.modules.reduce(
      (sum: number, m: { lessons: unknown[] }) => sum + m.lessons.length,
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
