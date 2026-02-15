"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { CheckCircle2, XCircle, ArrowRight, Eye } from "lucide-react";
import type { Exercise } from "@/types/exercise";

interface MCQExerciseProps {
  exercise: Exercise;
  onComplete: (isCorrect: boolean) => void;
}

function MCQExercise({ exercise, onComplete }: MCQExerciseProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealed, setRevealed] = useState(false);

  // Robust correctOptionIndex resolution
  // Priority: text match against options (most reliable) > correctOptionIndex > letter/number fallbacks
  const resolvedCorrectIndex = (() => {
    const options = exercise.options;
    if (!options || options.length === 0) return undefined;

    // 1. Try matching expectedAnswer text against option strings (most reliable)
    if (exercise.expectedAnswer) {
      const normalizedExpected = exercise.expectedAnswer.trim().toLowerCase();
      const textMatch = options.findIndex(
        (opt) => opt.trim().toLowerCase() === normalizedExpected
      );
      if (textMatch !== -1) return textMatch;
    }

    // 2. Try correctOptionIndex (AI may provide 0-based or 1-based)
    if (exercise.correctOptionIndex !== undefined && exercise.correctOptionIndex !== null) {
      const idx = Number(exercise.correctOptionIndex);
      if (!isNaN(idx) && idx >= 0 && idx < options.length) return idx;
    }

    // 3. Try matching expectedAnswer as letter (A=0, B=1, C=2, D=3) or number
    if (exercise.expectedAnswer) {
      const letterMap: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      const letter = exercise.expectedAnswer.trim().toUpperCase();
      if (letterMap[letter] !== undefined && letterMap[letter] < options.length) return letterMap[letter];

      const numVal = parseInt(exercise.expectedAnswer);
      if (!isNaN(numVal) && numVal >= 0 && numVal < options.length) return numVal;
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
        {(!exercise.options || !Array.isArray(exercise.options) || exercise.options.length === 0) ? (
          <div className="p-6 bg-accent-yellow/10 border-3 border-accent-yellow/40 rounded-[4px] text-center">
            <p className="font-bold text-sm mb-1">Options not available</p>
            <p className="text-xs text-muted">The AI did not generate options for this question. Try regenerating exercises.</p>
          </div>
        ) : (
          exercise.options.map((option, index) => {
            const state = getOptionState(index);

            return (
              <button
                type="button"
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
                  state === "selected" && "bg-secondary/10 border-secondary shadow-[3px_3px_0px_0px_#5294FF]",
                  state === "correct" && "bg-accent-green/15 border-accent-green shadow-[3px_3px_0px_0px_#05E17A]",
                  state === "wrong" && "bg-primary/15 border-primary shadow-[3px_3px_0px_0px_#FF6B6B]"
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex-shrink-0 w-8 h-8 flex items-center justify-center border-2 border-foreground rounded-[4px] text-sm font-bold",
                      state === "idle" && "bg-surface",
                      state === "selected" && "bg-secondary text-white border-secondary",
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

      {/* Warning: no correct answer resolved */}
      {exercise.options && exercise.options.length > 0 && resolvedCorrectIndex === undefined && !submitted && (
        <div className="p-4 bg-accent-yellow/10 border-2 border-accent-yellow/40 rounded-[4px] text-sm">
          <p className="font-bold text-accent-yellow">Unable to determine the correct answer for this question.</p>
          <p className="text-xs text-muted mt-1">Try regenerating exercises or skip this one.</p>
        </div>
      )}

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
        <>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={selectedIndex === null || !exercise.options?.length || revealed || resolvedCorrectIndex === undefined}
              size="lg"
              className="gap-2"
            >
              <CheckCircle2 size={18} />
              Check Answer
            </Button>
            {!revealed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowAnswer(true); setRevealed(true); }}
                className="gap-1"
              >
                <Eye size={14} />
                Show Answer
              </Button>
            )}
          </div>
          {revealed && (
            <div className="mt-4">
              <Button
                onClick={() => onComplete(false)}
                variant="secondary"
                size="lg"
                className="w-full gap-2"
              >
                Next Exercise <ArrowRight size={18} />
              </Button>
            </div>
          )}
        </>
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
                  {/* Show correct answer when wrong */}
                  {!isCorrect && resolvedCorrectIndex !== undefined && exercise.options && (
                    <div className="mb-3 p-3 bg-accent-green/10 border-2 border-accent-green/30 rounded-[4px]">
                      <p className="text-sm font-bold text-accent-green mb-1">
                        Correct Answer: {optionLabels[resolvedCorrectIndex]}
                      </p>
                      <p className="text-sm font-medium">
                        {exercise.options[resolvedCorrectIndex]}
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
