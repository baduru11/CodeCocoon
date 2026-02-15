import { NextResponse } from "next/server";
import { GeminiProvider, GeminiSchemas } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";
import type { RepoFile } from "@/types/github";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      files: RepoFile[];
      skillLevel: string;
      types?: string[];
      exerciseTypes?: string[];
    };

    if (!body.files || body.files.length === 0) {
      return NextResponse.json(
        { error: "Files are required to generate exercises" },
        { status: 400 }
      );
    }

    const ai = new GeminiProvider();
    const exerciseTypes = body.types || body.exerciseTypes || [
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
            body.files,
            body.skillLevel || "beginner",
            exerciseTypes
          ),
        },
      ],
      responseFormat: "json",
      responseSchema: GeminiSchemas.exercises,
      maxTokens: 16384,
    });

    let exercises: unknown[];
    try {
      const parsed = JSON.parse(result.content);
      exercises = Array.isArray(parsed) ? parsed : (parsed.exercises ?? []);
    } catch {
      console.error("Failed to parse exercises JSON, raw length:", result.content.length);
      exercises = [];
    }

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Failed to generate exercises:", error);
    return NextResponse.json(
      { error: "Failed to generate exercises" },
      { status: 500 }
    );
  }
}
