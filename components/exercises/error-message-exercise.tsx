"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/ui/code-block";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  Lightbulb,
  Eye,
  Loader2,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import type { Exercise } from "@/types/exercise";

interface ErrorMessageExerciseProps {
  exercise: Exercise;
  onComplete: (isCorrect: boolean) => void;
}

function ErrorMessageExercise({
  exercise,
  onComplete,
}: ErrorMessageExerciseProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    feedback: string;
  } | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const errorMessage = exercise.modifiedCode || "";

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/exercises/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseType: "error_message",
          prompt: exercise.prompt,
          expectedAnswer: exercise.expectedAnswer,
          userAnswer: userAnswer.trim(),
        }),
      });
      if (!res.ok) throw new Error("Evaluation failed");
      const result = await res.json();
      setFeedback({ isCorrect: result.isCorrect, feedback: result.feedback });
    } catch {
      setFeedback({
        isCorrect: false,
        feedback: "Could not evaluate your answer. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

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

      {/* Error Message — prominent red display */}
      {errorMessage && (
        <div className="border-3 border-primary rounded-[4px] shadow-[5px_5px_0px_0px_#FF6B6B] overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary text-white border-b-3 border-primary">
            <AlertTriangle size={16} />
            <span className="text-sm font-bold">Error Output</span>
          </div>
          <div className="p-4 bg-primary/5">
            <pre
              className="font-mono text-sm text-primary font-bold leading-relaxed"
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {errorMessage}
            </pre>
          </div>
        </div>
      )}

      {/* Code that caused the error */}
      {exercise.originalCode && (
        <CodeBlock
          code={exercise.originalCode}
          filename={exercise.relatedFile}
          language="typescript"
        />
      )}

      {/* Answer area */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Explanation</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Explain what causes this error and how to fix it..."
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="min-h-[150px] text-sm"
          />
          <div className="flex items-center gap-3 mt-4">
            <Button
              onClick={handleSubmit}
              disabled={!userAnswer.trim() || submitting || revealed}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <CheckCircle2 size={16} />
              )}
              Submit Explanation
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

      {/* Feedback */}
      {feedback && (
        <Card
          className={cn(
            feedback.isCorrect ? "border-accent-green" : "border-primary"
          )}
        >
          <CardContent className="pt-6 flex items-start gap-3">
            {feedback.isCorrect ? (
              <CheckCircle2
                size={20}
                className="text-accent-green shrink-0 mt-0.5"
              />
            ) : (
              <XCircle size={20} className="text-primary shrink-0 mt-0.5" />
            )}
            <p className="font-medium text-sm">{feedback.feedback}</p>
          </CardContent>
        </Card>
      )}

      {/* Expected answer */}
      {showAnswer && (
        <Card className="border-accent-purple">
          <CardHeader>
            <CardTitle className="text-base text-accent-purple">
              Expected Explanation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm font-medium whitespace-pre-wrap">
              {exercise.expectedAnswer}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Next — after submission */}
      {feedback && (
        <div className="text-center">
          <Button
            onClick={() => onComplete(feedback.isCorrect)}
            variant="secondary"
            size="lg"
            className="gap-2"
          >
            Next Exercise <ArrowRight size={18} />
          </Button>
        </div>
      )}

      {/* Next — after reveal without submission */}
      {revealed && !feedback && (
        <div className="text-center">
          <Button
            onClick={() => onComplete(false)}
            variant="secondary"
            size="lg"
            className="gap-2"
          >
            Next Exercise <ArrowRight size={18} />
          </Button>
        </div>
      )}
    </div>
  );
}

export { ErrorMessageExercise };
