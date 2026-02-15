import { NextResponse } from "next/server";
import { GeminiProvider, GeminiSchemas } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { techStack, skillLevel } = await request.json();

    if (!techStack || !Array.isArray(techStack) || techStack.length === 0) {
      return NextResponse.json(
        { error: "Tech stack array is required" },
        { status: 400 }
      );
    }

    const ai = new GeminiProvider();

    const result = await ai.generate({
      model: GEMINI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.generateQuizQuestions(techStack, skillLevel || "unknown"),
        },
      ],
      responseFormat: "json",
      responseSchema: GeminiSchemas.quizQuestions,
    });

    const { questions } = JSON.parse(result.content);

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Failed to generate questions:", error);
    return NextResponse.json(
      { error: "Failed to generate assessment questions" },
      { status: 500 }
    );
  }
}
