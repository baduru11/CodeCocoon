import { NextResponse } from "next/server";
import { createAIProvider } from "@/lib/ai/create-provider";
import { PROMPTS } from "@/lib/ai/prompts";
import { AI_MODELS } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const { techStack, skillLevel } = await request.json();

    if (!techStack || !Array.isArray(techStack) || techStack.length === 0) {
      return NextResponse.json(
        { error: "Tech stack array is required" },
        { status: 400 }
      );
    }

    const ai = createAIProvider();

    const result = await ai.generate({
      model: AI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.generateQuizQuestions(techStack, skillLevel || "unknown"),
        },
      ],
      responseFormat: "json",
    });

    let questions: unknown[];
    try {
      const parsed = JSON.parse(result.content);
      questions = Array.isArray(parsed) ? parsed : (parsed.questions ?? []);
    } catch {
      console.error("Failed to parse questions JSON, raw length:", result.content.length);
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
    }

    return NextResponse.json({ questions });
  } catch (error) {
    console.error("Failed to generate questions:", error);
    return NextResponse.json(
      { error: "Failed to generate assessment questions" },
      { status: 500 }
    );
  }
}
