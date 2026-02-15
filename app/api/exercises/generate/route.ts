import { NextResponse } from "next/server";
import { GeminiProvider, GeminiSchemas } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";
import type { RepoFile } from "@/types/github";

export async function POST(request: Request) {
  try {
    const { files, skillLevel, types } = (await request.json()) as {
      files: RepoFile[];
      skillLevel: string;
      types: string[];
    };

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "Files are required to generate exercises" },
        { status: 400 }
      );
    }

    const ai = new GeminiProvider();
    const exerciseTypes = types || [
      "error_injection",
      "code_recreation",
      "code_explanation",
    ];

    const result = await ai.generate({
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
      maxTokens: 16384,
    });

    const { exercises } = JSON.parse(result.content);

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Failed to generate exercises:", error);
    return NextResponse.json(
      { error: "Failed to generate exercises" },
      { status: 500 }
    );
  }
}
