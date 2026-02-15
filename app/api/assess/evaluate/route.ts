import { NextResponse } from "next/server";
import type { QuizQuestion, QuizAnswer, AssessmentResult } from "@/types/assessment";

export async function POST(request: Request) {
  try {
    const { questions, answers } = (await request.json()) as {
      questions: QuizQuestion[];
      answers: { questionId: string; selectedAnswer: number }[];
    };

    if (!questions || !answers) {
      return NextResponse.json(
        { error: "Questions and answers are required" },
        { status: 400 }
      );
    }

    // Evaluate answers
    const evaluatedAnswers: QuizAnswer[] = answers.map((answer) => {
      const question = questions.find((q) => q.id === answer.questionId);
      return {
        questionId: answer.questionId,
        selectedAnswer: answer.selectedAnswer,
        isCorrect: question
          ? answer.selectedAnswer === question.correctAnswer
          : false,
      };
    });

    const correctCount = evaluatedAnswers.filter((a) => a.isCorrect).length;
    const score = Math.round((correctCount / questions.length) * 100);

    // Determine skill level
    let skillLevel: "beginner" | "intermediate" | "advanced";
    if (score <= 35) {
      skillLevel = "beginner";
    } else if (score <= 70) {
      skillLevel = "intermediate";
    } else {
      skillLevel = "advanced";
    }

    // Topic breakdown
    const topicMap = new Map<string, { correct: number; total: number }>();
    for (const answer of evaluatedAnswers) {
      const question = questions.find((q) => q.id === answer.questionId);
      if (!question) continue;

      const existing = topicMap.get(question.topic) || { correct: 0, total: 0 };
      existing.total++;
      if (answer.isCorrect) existing.correct++;
      topicMap.set(question.topic, existing);
    }

    const topicBreakdown = Array.from(topicMap.entries()).map(
      ([topic, stats]) => ({
        topic,
        correct: stats.correct,
        total: stats.total,
      })
    );

    const result: AssessmentResult = {
      questions,
      answers: evaluatedAnswers,
      score,
      skillLevel,
      topicBreakdown,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Evaluation error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate assessment" },
      { status: 500 }
    );
  }
}
