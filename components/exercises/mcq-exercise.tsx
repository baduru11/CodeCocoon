"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { CheckCircle2, XCircle, ArrowRight, Eye, EyeOff } from "lucide-react";
import type { Exercise } from "@/types/exercise";

interface MCQExerciseProps {
  exercise: Exercise;
  onComplete: (isCorrect: boolean) => void;
}

function MCQExercise({ exercise, onComplete }: MCQExerciseProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  // Robust correctOptionIndex resolution: handle undefined, string, or number
  const resolvedCorrectIndex = (() => {
    if (exercise.correctOptionIndex !== undefined && exercise.correctOptionIndex !== null) {
      return Number(exercise.correctOptionIndex);
    }
    // Fallback: try to match expectedAnswer against options
    if (exercise.options && exercise.expectedAnswer) {
      const idx = exercise.options.findIndex(
        (opt) => opt.trim().toLowerCase() === exercise.expectedAnswer.trim().toLowerCase()
      );
      if (idx !== -1) return idx;
      // Try matching by index number in expectedAnswer (e.g. "1" or "B")
      const numVal = parseInt(exercise.expectedAnswer);
      if (!isNaN(numVal) && numVal >= 0 && numVal < exercise.options.length) return numVal;
      // Try letter match (A=0, B=1, C=2, D=3)
      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      const letter = exercise.expectedAnswer.trim().toUpperCase();
      if (letterMap[letter] !== undefined && letterMap[letter] < exercise.options.length) return letterMap[letter];
    }
    return undefined;
  })();

  const isCorrect = selectedIndex === resolvedCorrectIndex;

  const handleSubmit = () => {
    if (selectedIndex === null) return;
    setSubmitted(true);
  };

  const getOptionState = (index: number) => {
    if (!submitted) {
      return selectedIndex === index ? "selected" : "idle";
    }
    if (index === resolvedCorrectIndex) return "correct";
    if (index === selectedIndex && !isCorrect) return "wrong";
    return "idle";
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <div className="space-y-6">
      {/* Question */}
      <Card>
        <CardContent className="pt-6">
          <p className="font-bold text-lg leading-relaxed">{exercise.prompt}</p>
        </CardContent>
      </Card>

      {/* Code context */}
      {exercise.originalCode && (
        <CodeBlock
          code={exercise.originalCode}
          filename={exercise.relatedFile}
          language="typescript"
        />
      )}

      {/* Options */}
      <div className="grid gap-3">
        {(!exercise.options || exercise.options.length === 0) ? (
          <div className="p-6 bg-accent-yellow/10 border-3 border-accent-yellow/40 rounded-[4px] text-center">
            <p className="font-bold text-sm mb-1">Options not available</p>
            <p className="text-xs text-muted">The AI did not generate options for this question. Try regenerating exercises.</p>
          </div>
        ) : (
          exercise.options.map((option, index) => {
            const state = getOptionState(index);

            return (
              <button
                key={index}
                onClick={() => {
                  if (!submitted) setSelectedIndex(index);
                }}
                disabled={submitted}
                className={cn(
                  "w-full text-left p-4 border-3 border-foreground rounded-[4px] font-medium transition-all",
                  "shadow-[3px_3px_0px_0px_#1A1A1A]",
                  "disabled:cursor-default",
                  state === "idle" && !submitted && "bg-surface hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer",
                  state === "idle" && submitted && "bg-surface opacity-60",
                  state === "selected" && "bg-primary/10 border-primary shadow-[3px_3px_0px_0px_#FF6B6B]",
                  state === "correct" && "bg-accent-green/15 border-accent-green shadow-[3px_3px_0px_0px_#05E17A]",
                  state === "wrong" && "bg-primary/15 border-primary shadow-[3px_3px_0px_0px_#FF6B6B]"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-foreground rounded-[4px] text-sm font-bold",
                      state === "idle" && "bg-surface",
                      state === "selected" && "bg-primary text-white border-primary",
                      state === "correct" && "bg-accent-green text-foreground border-accent-green",
                      state === "wrong" && "bg-primary text-white border-primary"
                    )}
                  >
                    {state === "correct" ? (
                      <CheckCircle2 size={16} />
                    ) : state === "wrong" ? (
                      <XCircle size={16} />
                    ) : (
                      optionLabels[index]
                    )}
                  </span>
                  <span className="pt-1">{option}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Show Answer (before submit) */}
      {showAnswer && !submitted && (
        <Card className="border-accent-purple">
          <CardContent className="pt-6">
            {exercise.options && resolvedCorrectIndex !== undefined ? (
              <div>
                <p className="text-sm font-bold text-accent-purple mb-1">
                  Correct Answer: {optionLabels[resolvedCorrectIndex]}
                </p>
                <p className="text-sm font-medium">
                  {exercise.options[resolvedCorrectIndex]}
                </p>
              </div>
            ) : exercise.expectedAnswer ? (
              <div>
                <p className="text-sm font-bold text-accent-purple mb-1">
                  Correct Answer
                </p>
                <p className="text-sm font-medium">{exercise.expectedAnswer}</p>
              </div>
            ) : (
              <p className="text-sm text-muted">Answer not available.</p>
            )}
            {exercise.explanation && (
              <div className="mt-2 pt-2 border-t border-accent-purple/20">
                <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wide">Explanation</p>
                <p className="text-sm font-medium text-muted leading-relaxed">
                  {exercise.explanation}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Submit / Explanation / Next */}
      {!submitted ? (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSubmit}
            disabled={selectedIndex === null || !exercise.options?.length}
            size="lg"
            className="gap-2"
          >
            <CheckCircle2 size={18} />
            Check Answer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAnswer(!showAnswer)}
            className="gap-1"
          >
            {showAnswer ? <EyeOff size={14} /> : <Eye size={14} />}
            {showAnswer ? "Hide" : "Show"} Answer
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Explanation */}
          <Card
            className={cn(
              isCorrect ? "border-accent-green" : "border-primary"
            )}
          >
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {isCorrect ? (
                  <CheckCircle2 size={22} className="text-accent-green shrink-0 mt-0.5" />
                ) : (
                  <XCircle size={22} className="text-primary shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold mb-1">
                    {isCorrect ? "Correct!" : "Not quite right"}
                  </p>
                  {/* When wrong, explicitly show the correct answer */}
                  {!isCorrect && exercise.options && resolvedCorrectIndex !== undefined && (
                    <div className="mb-3 p-3 bg-accent-green/10 border-2 border-accent-green/30 rounded-[4px]">
                      <p className="text-sm font-bold text-accent-green mb-1">
                        Correct Answer: {optionLabels[resolvedCorrectIndex]}
                      </p>
                      <p className="text-sm font-medium">
                        {exercise.options[resolvedCorrectIndex]}
                      </p>
                    </div>
                  )}
                  {/* Fallback when correctOptionIndex could not be resolved */}
                  {!isCorrect && exercise.options && resolvedCorrectIndex === undefined && exercise.expectedAnswer && (
                    <div className="mb-3 p-3 bg-accent-green/10 border-2 border-accent-green/30 rounded-[4px]">
                      <p className="text-sm font-bold text-accent-green mb-1">
                        Correct Answer
                      </p>
                      <p className="text-sm font-medium">
                        {exercise.expectedAnswer}
                      </p>
                    </div>
                  )}
                  {exercise.explanation ? (
                    <div>
                      <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wide">Explanation</p>
                      <p className="text-sm font-medium text-muted leading-relaxed">
                        {exercise.explanation}
                      </p>
                    </div>
                  ) : !isCorrect && (
                    <div>
                      <p className="text-xs font-bold text-muted mb-1 uppercase tracking-wide">Explanation</p>
                      <p className="text-sm font-medium text-muted leading-relaxed">
                        {exercise.expectedAnswer || "Review the code carefully and try again."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Next */}
          <Button
            onClick={() => onComplete(isCorrect)}
            variant="secondary"
            size="lg"
            className="w-full gap-2"
          >
            Next Exercise <ArrowRight size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}

export { MCQExercise };
