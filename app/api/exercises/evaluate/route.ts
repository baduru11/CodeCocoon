import { NextResponse } from "next/server";
import { GeminiProvider } from "@/lib/ai/gemini";
import { PROMPTS } from "@/lib/ai/prompts";
import { GEMINI_MODELS } from "@/lib/constants";

interface EvaluateRequest {
  exerciseType: string;
  prompt: string;
  expectedAnswer: string;
  userAnswer: string;
}

export async function POST(request: Request) {
  try {
    const { exerciseType, prompt, expectedAnswer, userAnswer } =
      (await request.json()) as EvaluateRequest;

    if (!exerciseType || !prompt || !expectedAnswer || !userAnswer) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const ai = new GeminiProvider();

    const result = await ai.generate({
      model: GEMINI_MODELS.fast,
      messages: [
        {
          role: "user",
          content: PROMPTS.evaluateExerciseAnswer(
            exerciseType,
            prompt,
            expectedAnswer,
            userAnswer
          ),
        },
      ],
      responseFormat: "json",
    });

    let evaluation: { isCorrect: boolean; feedback: string };
    try {
      evaluation = JSON.parse(result.content);
    } catch {
      evaluation = {
        isCorrect: false,
        feedback: "Could not evaluate your answer. Please try again.",
      };
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    console.error("Exercise evaluation error:", error);
    return NextResponse.json(
      { error: "Evaluation failed" },
      { status: 500 }
    );
  }
}
