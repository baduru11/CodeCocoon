"use client";

import { useState, useCallback, useEffect } from "react";
import { updateSessionExercises } from "@/lib/project-sessions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Bug,
  PenTool,
  MessageSquare,
  Plus,
  RotateCcw,
  ArrowDownUp,
  AlertTriangle,
  Trophy,
  BarChart3,
  ArrowLeft,
} from "lucide-react";
import { MCQExercise } from "@/components/exercises/mcq-exercise";
import { TextExercise } from "@/components/exercises/text-exercise";
import { FillBlankExercise } from "@/components/exercises/fill-blank-exercise";
import { ParsonsExercise } from "@/components/exercises/parsons-exercise";
import { ErrorMessageExercise } from "@/components/exercises/error-message-exercise";
import type { ProjectSession } from "@/types/project-session";
import type { Exercise } from "@/types/exercise";

interface ExercisesTabProps {
  session: ProjectSession;
}

const typeConfig: Record<string, { label: string; icon: typeof Bug; color: string }> = {
  error_injection: { label: "Bug Hunt", icon: Bug, color: "bg-primary" },
  code_recreation: { label: "Fill in Blank", icon: PenTool, color: "bg-secondary" },
  code_explanation: { label: "Explain", icon: MessageSquare, color: "bg-accent-purple" },
  mcq: { label: "Multiple Choice", icon: MessageSquare, color: "bg-secondary" },
  output_prediction: { label: "Predict Output", icon: MessageSquare, color: "bg-accent-yellow" },
  parsons: { label: "Code Order", icon: ArrowDownUp, color: "bg-accent-green" },
  error_message: { label: "Fix the Error", icon: AlertTriangle, color: "bg-primary" },
};

const EXERCISE_TYPES = [
  "all",
  "error_injection",
  "code_recreation",
  "code_explanation",
  "mcq",
  "output_prediction",
  "parsons",
  "error_message",
] as const;

export function ExercisesTab({ session }: ExercisesTabProps) {
  const exercises = session.exercises ?? [];

  const [currentEx, setCurrentEx] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [attempted, setAttempted] = useState<Set<number>>(new Set());
  const [activeFilter, setActiveFilter] = useState<(typeof EXERCISE_TYPES)[number]>("all");
  const [difficulty, setDifficulty] = useState<"beginner" | "intermediate" | "advanced">(
    (session.skillLevel as "beginner" | "intermediate" | "advanced") || "beginner"
  );
  const [generating, setGenerating] = useState(false);
  const [showScore, setShowScore] = useState(false);

  const filteredExercises =
    activeFilter === "all" ? exercises : exercises.filter((e) => e.type === activeFilter);

  // Auto-show score when all exercises attempted
  useEffect(() => {
    if (filteredExercises.length > 0 && attempted.size >= filteredExercises.length) {
      setShowScore(true);
    }
  }, [attempted.size, filteredExercises.length]);

  const advanceToNext = useCallback(() => {
    setCurrentEx((prev) => Math.min(prev + 1, filteredExercises.length - 1));
  }, [filteredExercises.length]);

  const handleComplete = useCallback(
    (isCorrect: boolean) => {
      const newAttempted = new Set(attempted);
      newAttempted.add(currentEx);
      setAttempted(newAttempted);
      if (isCorrect) {
        setCompleted((prev) => new Set(prev).add(currentEx));
      }
      // Directly show score if all exercises have been attempted
      if (newAttempted.size >= filteredExercises.length) {
        setShowScore(true);
      } else {
        advanceToNext();
      }
    },
    [currentEx, advanceToNext, attempted, filteredExercises.length]
  );

  const handleGenerateMore = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/exercises/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: session.projectData.files.slice(0, 5),
          skillLevel: difficulty,
          exerciseTypes: [
            "error_injection",
            "code_recreation",
            "code_explanation",
            "mcq",
            "output_prediction",
            "parsons",
            "error_message",
          ],
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      const newExercises = Array.isArray(data.exercises)
        ? data.exercises
        : data.exercises?.exercises || [];
      if (newExercises.length > 0) {
        const updated = [...exercises, ...newExercises];
        updateSessionExercises(session.id, updated);
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to generate more exercises:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/exercises/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: session.projectData.files.slice(0, 5),
          skillLevel: difficulty,
          exerciseTypes: [
            "error_injection",
            "code_recreation",
            "code_explanation",
            "mcq",
            "output_prediction",
            "parsons",
            "error_message",
          ],
        }),
      });
      if (!res.ok) throw new Error("Generation failed");
      const data = await res.json();
      const newExercises = Array.isArray(data.exercises)
        ? data.exercises
        : data.exercises?.exercises || [];
      if (newExercises.length > 0) {
        updateSessionExercises(session.id, newExercises);
        window.location.reload();
      }
    } catch (err) {
      console.error("Failed to regenerate exercises:", err);
    } finally {
      setGenerating(false);
    }
  };

  // No exercises — show generate prompt
  if (exercises.length === 0) {
    return (
      <div className="text-center py-16">
        <Bug size={48} className="mx-auto mb-4 text-muted" />
        <h2 className="text-2xl font-bold mb-3">No Exercises Yet</h2>
        <p className="text-muted font-medium mb-8">
          Generate exercises from your analyzed codebase.
        </p>
        <div className="flex flex-col items-center gap-3">
          <DifficultySelector difficulty={difficulty} onDifficultyChange={setDifficulty} />
          <Button onClick={handleRegenerate} disabled={generating} size="lg" className="gap-2">
            {generating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
            Generate Exercises
          </Button>
          {generating && (
            <span className="text-xs text-muted font-medium">Generating exercises with AI...</span>
          )}
        </div>
      </div>
    );
  }

  // Score view
  if (showScore) {
    const scorePercent =
      attempted.size > 0 ? Math.round((completed.size / attempted.size) * 100) : 0;

    // Per-type breakdown
    const typeBreakdown: { type: string; label: string; color: string; correct: number; total: number }[] = [];
    const typesSeen = new Set<string>();
    filteredExercises.forEach((ex, i) => {
      if (!typesSeen.has(ex.type)) {
        typesSeen.add(ex.type);
        const ofType = filteredExercises
          .map((e, idx) => ({ e, idx }))
          .filter(({ e }) => e.type === ex.type);
        const correctCount = ofType.filter(({ idx }) => completed.has(idx)).length;
        const attemptedCount = ofType.filter(({ idx }) => attempted.has(idx)).length;
        const config = typeConfig[ex.type];
        if (config) {
          typeBreakdown.push({
            type: ex.type,
            label: config.label,
            color: config.color,
            correct: correctCount,
            total: attemptedCount,
          });
        }
      }
    });

    return (
      <div className="max-w-2xl mx-auto py-8 space-y-8">
        {/* Score Card */}
        <Card className="border-3 border-foreground shadow-[5px_5px_0px_0px_#1A1A1A]">
          <CardContent className="pt-8 pb-8 text-center">
            <Trophy
              size={48}
              className={cn(
                "mx-auto mb-4",
                scorePercent >= 80
                  ? "text-accent-green"
                  : scorePercent >= 60
                    ? "text-accent-yellow"
                    : "text-primary"
              )}
            />
            <p className="text-sm font-bold text-muted mb-2">Your Score</p>
            <p
              className={cn(
                "text-6xl font-bold",
                scorePercent >= 80
                  ? "text-accent-green"
                  : scorePercent >= 60
                    ? "text-accent-yellow"
                    : "text-primary"
              )}
            >
              {scorePercent}%
            </p>
            <p className="text-sm text-muted font-medium mt-2">
              {completed.size} correct out of {attempted.size} attempted
            </p>
          </CardContent>
        </Card>

        {/* Per-type Breakdown */}
        {typeBreakdown.length > 0 && (
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold mb-4">
              <BarChart3 size={16} />
              Breakdown by Type
            </h3>
            <div className="space-y-3">
              {typeBreakdown.map((tb) => {
                const pct = tb.total > 0 ? Math.round((tb.correct / tb.total) * 100) : 0;
                return (
                  <div key={tb.type} className="flex items-center gap-3">
                    <span className="text-sm font-bold w-32 shrink-0">{tb.label}</span>
                    <div className="flex-1 h-6 bg-surface border-2 border-foreground/15 rounded-[4px] overflow-hidden">
                      <div
                        className={cn("h-full transition-all", tb.color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-muted w-16 text-right">
                      {tb.correct}/{tb.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="space-y-4">
          <DifficultySelector difficulty={difficulty} onDifficultyChange={setDifficulty} />

          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleGenerateMore}
              disabled={generating}
              variant="secondary"
              className="gap-2"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Generate More
            </Button>
            <Button
              onClick={handleRegenerate}
              disabled={generating}
              variant="ghost"
              className="gap-2"
            >
              <RotateCcw size={16} />
              Regenerate All
            </Button>
            <Button
              onClick={() => setShowScore(false)}
              variant="outline"
              className="gap-2"
            >
              <ArrowLeft size={16} />
              Review Exercises
            </Button>
          </div>

          {generating && (
            <span className="text-xs text-muted font-medium">Generating exercises with AI...</span>
          )}
        </div>
      </div>
    );
  }

  // Exercise view
  const exercise = filteredExercises[currentEx];

  if (!exercise) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-3">No exercises match this filter</h2>
        <Button
          onClick={() => {
            setActiveFilter("all");
            setCurrentEx(0);
          }}
          variant="outline"
          className="mt-4"
        >
          Show All Exercises
        </Button>
      </div>
    );
  }

  const config = typeConfig[exercise.type] || typeConfig.code_explanation;

  const renderExercise = () => {
    switch (exercise.type) {
      case "mcq":
      case "output_prediction":
        return <MCQExercise key={exercise.id} exercise={exercise} onComplete={handleComplete} />;
      case "code_recreation":
        return (
          <FillBlankExercise key={exercise.id} exercise={exercise} onComplete={handleComplete} />
        );
      case "parsons":
        return (
          <ParsonsExercise key={exercise.id} exercise={exercise} onComplete={handleComplete} />
        );
      case "error_message":
        return (
          <ErrorMessageExercise
            key={exercise.id}
            exercise={exercise}
            onComplete={handleComplete}
          />
        );
      default:
        return <TextExercise key={exercise.id} exercise={exercise} onComplete={handleComplete} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Type Filter Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {EXERCISE_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => {
              setActiveFilter(type);
              setCurrentEx(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-[4px] font-bold text-sm border-2 transition-all",
              activeFilter === type
                ? "border-foreground bg-accent-yellow text-foreground"
                : "border-foreground/20 bg-surface text-muted hover:border-foreground/40"
            )}
          >
            {type === "all"
              ? "All"
              : typeConfig[type as keyof typeof typeConfig]?.label || type}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary" className={config.color}>
              {config.label}
            </Badge>
            <Badge
              variant={
                exercise.difficulty === "beginner"
                  ? "success"
                  : exercise.difficulty === "intermediate"
                    ? "warning"
                    : "danger"
              }
            >
              {exercise.difficulty}
            </Badge>
            <span className="text-xs font-bold text-muted">
              {currentEx + 1}/{filteredExercises.length}
            </span>
          </div>
          <h2 className="text-2xl font-bold">{exercise.title}</h2>
        </div>
        <div className="text-sm font-bold text-muted">
          {completed.size}/{filteredExercises.length} done
        </div>
      </div>

      {/* Exercise Component */}
      {renderExercise()}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <Button
          onClick={() => setCurrentEx(Math.max(0, currentEx - 1))}
          disabled={currentEx === 0}
          variant="outline"
          size="sm"
        >
          Previous
        </Button>
        <Button
          onClick={() => setCurrentEx(Math.min(filteredExercises.length - 1, currentEx + 1))}
          disabled={currentEx >= filteredExercises.length - 1}
          variant="outline"
          size="sm"
        >
          Skip →
        </Button>
      </div>

      {/* View Score — only visible on last exercise */}
      {currentEx >= filteredExercises.length - 1 && (
        <div className="mt-6 pt-6 border-t-2 border-foreground/10">
          <Button
            onClick={() => setShowScore(true)}
            variant="secondary"
            size="lg"
            className="w-full gap-2"
          >
            <Trophy size={18} />
            View Score ({completed.size}/{filteredExercises.length} correct)
          </Button>
        </div>
      )}
    </div>
  );
}

// Difficulty selector sub-component
function DifficultySelector({
  difficulty,
  onDifficultyChange,
}: {
  difficulty: "beginner" | "intermediate" | "advanced";
  onDifficultyChange: (d: "beginner" | "intermediate" | "advanced") => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-bold text-muted">Difficulty:</span>
      {(["beginner", "intermediate", "advanced"] as const).map((d) => (
        <button
          key={d}
          onClick={() => onDifficultyChange(d)}
          className={cn(
            "px-3 py-1.5 rounded-[4px] font-bold text-sm border-2 transition-all capitalize",
            difficulty === d
              ? "border-foreground bg-secondary text-white"
              : "border-foreground/20 bg-surface text-muted hover:border-foreground/40"
          )}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
