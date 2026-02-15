"use client";

import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  Eye,
} from "lucide-react";
import type { Exercise } from "@/types/exercise";

interface FillBlankExerciseProps {
  exercise: Exercise;
  onComplete: (isCorrect: boolean) => void;
}

function FillBlankExercise({ exercise, onComplete }: FillBlankExerciseProps) {
  const code = exercise.modifiedCode || exercise.originalCode || "";

  // Parse blank numbers from the code
  const blankNumbers = useMemo(() => {
    const nums: number[] = [];
    const pattern = /___BLANK_(\d+)___/g;
    let match;
    while ((match = pattern.exec(code)) !== null) {
      const n = parseInt(match[1]);
      if (!nums.includes(n)) nums.push(n);
    }
    return nums.sort((a, b) => a - b);
  }, [code]);

  // Parse expected blank answers from expectedAnswer JSON
  const expectedBlanks = useMemo(() => {
    try {
      return JSON.parse(exercise.expectedAnswer) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  }, [exercise.expectedAnswer]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleSubmit = () => {
    const newResults: Record<string, boolean> = {};
    for (const num of blankNumbers) {
      const key = num.toString();
      const userVal = (answers[key] || "").trim();
      const expectedVal = (expectedBlanks[key] || "").trim();
      // Flexible comparison: case-insensitive, ignore trailing semicolons and extra spaces
      const normalize = (s: string) =>
        s.toLowerCase().replace(/;$/, "").replace(/\s+/g, " ").trim();
      newResults[key] = normalize(userVal) === normalize(expectedVal);
    }
    setResults(newResults);
    setSubmitted(true);
  };

  // Render code with blanks as highlighted numbered placeholders
  const renderCodeWithBlanks = () => {
    const parts = code.split(/(___BLANK_\d+___)/g);
    return parts.map((part, i) => {
      const blankMatch = part.match(/___BLANK_(\d+)___/);
      if (blankMatch) {
        const num = blankMatch[1];
        const result = results[num];
        return (
          <span
            key={i}
            className={cn(
              "inline-block px-2 py-0.5 rounded-[4px] font-bold text-sm mx-0.5 border-2",
              submitted && result === true &&
                "bg-accent-green/20 text-accent-green border-accent-green/40",
              submitted && result === false &&
                "bg-primary/20 text-primary border-primary/40",
              !submitted &&
                "bg-accent-yellow/20 text-foreground border-accent-yellow/60"
            )}
          >
            {submitted && result === true
              ? expectedBlanks[num] || `[${num}]`
              : submitted && result === false
                ? `${answers[num] || "?"} → ${expectedBlanks[num]}`
                : `[ ${num} ]`}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const correctCount = Object.values(results).filter(Boolean).length;
  const allCorrect = submitted && correctCount === blankNumbers.length;
  const allFilled = blankNumbers.every((n) => answers[n.toString()]?.trim());

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

      {/* Code with blanks */}
      <div className="border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-foreground text-surface border-b-3 border-foreground">
          <span className="text-sm font-bold font-mono">
            {exercise.relatedFile}
          </span>
          <span className="text-xs font-bold text-surface/60">
            {blankNumbers.length} blank{blankNumbers.length !== 1 ? "s" : ""} to
            fill
          </span>
        </div>
        <pre
          className="p-4 bg-white font-mono text-sm leading-relaxed overflow-x-auto"
          style={{
            fontFamily: "var(--font-mono), monospace",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            whiteSpace: "pre-wrap",
          }}
        >
          {renderCodeWithBlanks()}
        </pre>
      </div>

      {/* Blank input fields */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Fill in the blanks
            {submitted && (
              <span
                className={cn(
                  "ml-2 text-sm font-bold",
                  allCorrect ? "text-accent-green" : "text-primary"
                )}
              >
                {correctCount}/{blankNumbers.length} correct
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {blankNumbers.map((num) => {
              const key = num.toString();
              const result = results[key];
              return (
                <div key={num} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-8 h-8 flex items-center justify-center border-2 border-foreground rounded-[4px] text-sm font-bold shrink-0",
                      submitted && result === true &&
                        "bg-accent-green text-white border-accent-green",
                      submitted && result === false &&
                        "bg-primary text-white border-primary",
                      !submitted && "bg-accent-yellow/20"
                    )}
                  >
                    {submitted ? (
                      result ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <XCircle size={16} />
                      )
                    ) : (
                      num
                    )}
                  </span>
                  <div className="flex-1">
                    <input
                      value={answers[key] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      disabled={submitted}
                      placeholder={`Blank ${num}`}
                      className={cn(
                        "w-full px-3 py-2 bg-surface border-3 border-foreground rounded-[4px] font-mono text-sm",
                        "shadow-[3px_3px_0px_0px_#1A1A1A]",
                        "focus:shadow-[5px_5px_0px_0px_#1A1A1A] focus:outline-none",
                        "transition-shadow placeholder:text-muted/60",
                        "disabled:opacity-70 disabled:cursor-not-allowed",
                        submitted && result === true &&
                          "border-accent-green bg-accent-green/5 shadow-[3px_3px_0px_0px_#05E17A]",
                        submitted && result === false &&
                          "border-primary bg-primary/5 shadow-[3px_3px_0px_0px_#FF6B6B]"
                      )}
                    />
                  </div>
                  {submitted && result === false && expectedBlanks[key] && (
                    <span className="text-sm font-mono font-bold text-accent-green shrink-0 whitespace-nowrap">
                      → {expectedBlanks[key]}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
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

      {/* Show Answer */}
      {showAnswer && (
        <Card className="border-accent-purple">
          <CardHeader>
            <CardTitle className="text-base text-accent-purple">
              Expected Answers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {blankNumbers.map((num) => {
                const key = num.toString();
                return (
                  <div key={num} className="flex items-center gap-2">
                    <span className="w-7 h-7 flex items-center justify-center border-2 border-foreground rounded-[4px] text-xs font-bold bg-accent-purple/10 shrink-0">
                      {num}
                    </span>
                    <code className="text-sm font-mono font-bold text-accent-purple">
                      {expectedBlanks[key] || "N/A"}
                    </code>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      {!submitted ? (
        <>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSubmit}
              disabled={!allFilled || revealed}
              className="gap-2"
            >
              <CheckCircle2 size={16} />
              Check Answers
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
              <div>
                <p className="font-bold text-sm">
                  {allCorrect
                    ? "All blanks filled correctly!"
                    : `${correctCount}/${blankNumbers.length} correct. The correct values are shown above and in the code.`}
                </p>
              </div>
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

export { FillBlankExercise };
