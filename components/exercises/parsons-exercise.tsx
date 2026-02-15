"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Eye,
} from "lucide-react";
import type { Exercise } from "@/types/exercise";

interface ParsonsExerciseProps {
  exercise: Exercise;
  onComplete: (isCorrect: boolean) => void;
}

function ParsonsExercise({ exercise, onComplete }: ParsonsExerciseProps) {
  // Parse shuffled lines from modifiedCode and correct order from expectedAnswer
  const shuffledLines = useMemo(() => {
    try {
      const parsed = JSON.parse(exercise.modifiedCode || "[]");
      return Array.isArray(parsed) ? parsed as string[] : [];
    } catch {
      return [];
    }
  }, [exercise.modifiedCode]);

  const correctOrder = useMemo(() => {
    try {
      const parsed = JSON.parse(exercise.expectedAnswer);
      return Array.isArray(parsed) ? parsed as string[] : [];
    } catch {
      return [];
    }
  }, [exercise.expectedAnswer]);

  // Pool = lines not yet placed; placed = user's ordered answer
  const [placed, setPlaced] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [lineResults, setLineResults] = useState<boolean[]>([]);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const availablePool = useMemo(() => {
    const result: string[] = [...shuffledLines];
    for (const p of placed) {
      const idx = result.indexOf(p);
      if (idx !== -1) result.splice(idx, 1);
    }
    return result;
  }, [shuffledLines, placed]);

  const addToPlaced = (line: string) => {
    if (submitted) return;
    setPlaced((prev) => [...prev, line]);
  };

  const removeFromPlaced = (index: number) => {
    if (submitted) return;
    setPlaced((prev) => prev.filter((_, i) => i !== index));
  };

  const moveUp = (index: number) => {
    if (submitted || index === 0) return;
    setPlaced((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  };

  const moveDown = (index: number) => {
    if (submitted || index >= placed.length - 1) return;
    setPlaced((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  };

  const handleSubmit = () => {
    const results = placed.map(
      (line, i) => line.trim() === (correctOrder[i] || "").trim()
    );
    setLineResults(results);
    setSubmitted(true);
  };

  const correctCount = lineResults.filter(Boolean).length;
  const allCorrect =
    submitted &&
    correctCount === correctOrder.length &&
    placed.length === correctOrder.length;

  return (
    <div className="space-y-6">
      {/* Prompt */}
      <Card>
        <CardContent className="pt-6">
          <p className="font-bold text-lg leading-relaxed">{exercise.prompt}</p>
          <p className="text-xs text-muted mt-2">
            From: {exercise.relatedFile}
          </p>
        </CardContent>
      </Card>

      {/* Available Lines Pool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Available Lines
            <span className="text-sm font-bold text-muted">
              ({availablePool.length} remaining)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {availablePool.length === 0 ? (
            <p className="text-sm text-muted font-medium text-center py-4">
              {submitted
                ? "All lines placed"
                : "All lines have been placed below. Reorder or remove lines as needed."}
            </p>
          ) : (
            <div className="space-y-2">
              {availablePool.map((line, index) => (
                <button
                  key={`pool-${index}`}
                  onClick={() => addToPlaced(line)}
                  disabled={submitted}
                  className={cn(
                    "w-full text-left px-4 py-2.5 border-3 border-foreground rounded-[4px] font-mono text-sm",
                    "shadow-[3px_3px_0px_0px_#1A1A1A] transition-all",
                    !submitted &&
                      "bg-surface hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none cursor-pointer hover:bg-accent-green/10",
                    submitted && "bg-surface opacity-60 cursor-default"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Plus size={14} className="shrink-0 text-accent-green" />
                    <code
                      className="flex-1"
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {line}
                    </code>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* User's Ordered Answer */}
      <Card className="border-secondary">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Your Order
            {submitted && (
              <span
                className={cn(
                  "text-sm font-bold",
                  allCorrect ? "text-accent-green" : "text-primary"
                )}
              >
                {correctCount}/{correctOrder.length} correct
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {placed.length === 0 ? (
            <div className="py-8 text-center border-2 border-dashed border-foreground/20 rounded-[4px]">
              <p className="text-sm text-muted font-medium">
                Click lines above to add them here in the correct order
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {placed.map((line, index) => {
                const result = lineResults[index];
                return (
                  <div
                    key={`placed-${index}`}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border-3 border-foreground rounded-[4px] font-mono text-sm",
                      "shadow-[3px_3px_0px_0px_#1A1A1A]",
                      submitted && result === true &&
                        "border-accent-green bg-accent-green/10 shadow-[3px_3px_0px_0px_#05E17A]",
                      submitted && result === false &&
                        "border-primary bg-primary/10 shadow-[3px_3px_0px_0px_#FF6B6B]",
                      !submitted && "bg-surface"
                    )}
                  >
                    {/* Line number */}
                    <span
                      className={cn(
                        "w-7 h-7 flex items-center justify-center border-2 border-foreground rounded-[4px] text-xs font-bold shrink-0",
                        submitted && result === true &&
                          "bg-accent-green text-white border-accent-green",
                        submitted && result === false &&
                          "bg-primary text-white border-primary",
                        !submitted && "bg-foreground/5"
                      )}
                    >
                      {submitted ? (
                        result ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <XCircle size={14} />
                        )
                      ) : (
                        index + 1
                      )}
                    </span>

                    {/* Code line */}
                    <code
                      className="flex-1 min-w-0"
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {line}
                    </code>

                    {/* Correct line (shown when wrong) */}
                    {submitted && result === false && correctOrder[index] && (
                      <span className="text-xs font-mono text-accent-green shrink-0 max-w-[200px] truncate" title={correctOrder[index]}>
                        → {correctOrder[index].trim()}
                      </span>
                    )}

                    {/* Controls (only before submit) */}
                    {!submitted && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => moveUp(index)}
                          disabled={index === 0}
                          className="p-1 rounded-[4px] hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          onClick={() => moveDown(index)}
                          disabled={index >= placed.length - 1}
                          className="p-1 rounded-[4px] hover:bg-foreground/10 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <ChevronDown size={14} />
                        </button>
                        <button
                          onClick={() => removeFromPlaced(index)}
                          className="p-1 rounded-[4px] hover:bg-primary/10 text-primary"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hints */}
      {hintsRevealed > 0 && (
        <div className="space-y-2">
          {exercise.hints.slice(0, hintsRevealed).map((hint, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-3 bg-accent-yellow/10 border-2 border-accent-yellow/40 rounded-[4px]"
            >
              <Lightbulb
                size={14}
                className="mt-0.5 text-accent-yellow shrink-0"
              />
              <p className="text-sm font-medium">{hint}</p>
            </div>
          ))}
        </div>
      )}

      {/* Show Answer (before submit) */}
      {showAnswer && !submitted && (
        <Card className="border-accent-purple">
          <CardHeader>
            <CardTitle className="text-base text-accent-purple">
              Correct Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre
              className="p-4 bg-white font-mono text-sm leading-relaxed rounded-[4px] border-2 border-foreground/10 overflow-x-auto"
            >
              {correctOrder.join("\n")}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!submitted ? (
        <>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={placed.length !== shuffledLines.length || revealed}
              className="gap-2"
            >
              <CheckCircle2 size={16} />
              Check Order
            </Button>
            {exercise.hints.length > hintsRevealed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHintsRevealed((p) => p + 1)}
                className="gap-1"
              >
                <Lightbulb size={14} /> Hint ({hintsRevealed}/
                {exercise.hints.length})
              </Button>
            )}
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
          {/* Show correct order when wrong */}
          {!allCorrect && (
            <Card className="border-accent-green">
              <CardHeader>
                <CardTitle className="text-base text-accent-green">
                  Correct Order
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre
                  className="p-4 bg-white font-mono text-sm leading-relaxed rounded-[4px] border-2 border-foreground/10"
                  style={{
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {correctOrder.join("\n")}
                </pre>
              </CardContent>
            </Card>
          )}

          <Card
            className={cn(
              allCorrect ? "border-accent-green" : "border-primary"
            )}
          >
            <CardContent className="pt-6 flex items-start gap-3">
              {allCorrect ? (
                <CheckCircle2
                  size={20}
                  className="text-accent-green shrink-0 mt-0.5"
                />
              ) : (
                <XCircle
                  size={20}
                  className="text-primary shrink-0 mt-0.5"
                />
              )}
              <p className="font-bold text-sm">
                {allCorrect
                  ? "Perfect order! You nailed it!"
                  : `${correctCount}/${correctOrder.length} lines in the correct position. See the correct order above.`}
              </p>
            </CardContent>
          </Card>

          <Button
            onClick={() => onComplete(allCorrect)}
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

export { ParsonsExercise };
