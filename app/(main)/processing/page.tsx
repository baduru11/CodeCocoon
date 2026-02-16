"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useProcessing } from "@/hooks/use-processing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  Loader2, CheckCircle2, Circle, ArrowRight, RotateCcw, AlertTriangle,
} from "lucide-react";
import type { ProcessConfig } from "@/types/github";
import type { ProjectSession } from "@/types/project-session";
import { saveSession, setActiveSessionId } from "@/lib/project-sessions";

export default function ProcessingPage() {
  const router = useRouter();
  const { value: processConfig, isLoaded } = useLocalStorage<ProcessConfig | null>("processConfig", null);

  const {
    status, currentStep, steps, results, error, process: startProcessing,
    progressPercent,
  } = useProcessing();
  const [started, setStarted] = useState(false);

  // Redirect if no config
  useEffect(() => {
    if (isLoaded && !processConfig) {
      router.push("/connect");
    }
  }, [isLoaded, processConfig, router]);

  // Auto-start processing on mount
  useEffect(() => {
    if (isLoaded && processConfig && !started && status === "idle") {
      setStarted(true);
      startProcessing(processConfig);
    }
  }, [isLoaded, processConfig, started, status, startProcessing]);

  // Save results as ProjectSession on complete — uses ref to prevent double-save
  const savedRef = useRef(false);

  useEffect(() => {
    if (status === "complete" && results && processConfig && !savedRef.current) {
      // Guard: need at minimum projectData and analysis to save
      if (!results.projectData || !results.analysis) return;

      savedRef.current = true;

      const session: ProjectSession = {
        id: crypto.randomUUID(),
        repoName: processConfig.repoName,
        repoUrl: `https://github.com/${processConfig.owner}/${processConfig.repo}`,
        analyzedAt: new Date().toISOString(),
        skillLevel: processConfig.skillLevel || "beginner",
        projectData: results.projectData,
        analysisData: {
          techStack: results.analysis.techStack ?? { languages: [], frameworks: [], databases: [], tools: [], styling: [] },
          architecture: results.analysis.architecture ?? { pattern: "Unknown", description: "", layers: [], entryPoints: [] },
          keyFiles: results.analysis.keyFiles ?? [],
          summary: results.analysis.summary ?? "",
        },
        learningPath: results.learningPath ?? {
          id: "",
          projectId: "",
          title: "Learning Path",
          description: "No learning path was generated. Try re-analyzing the project.",
          skillLevel: processConfig.skillLevel || "beginner",
          modules: [],
          totalLessons: 0,
          completedLessons: 0,
        },
        exercises: Array.isArray(results.exercises) ? results.exercises : [],
      };
      saveSession(session);
      setActiveSessionId(session.id);
    }
  }, [status, results, processConfig]);

  const handleRetry = () => {
    if (processConfig) {
      savedRef.current = false;
      setStarted(false);
    }
  };

  // Reset started flag on retry (when started becomes false again)
  useEffect(() => {
    if (!started && processConfig && status === "error") {
      setStarted(true);
      startProcessing(processConfig);
    }
  }, [started, processConfig, status, startProcessing]);

  if (!isLoaded || !processConfig) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-2">
          {status === "complete"
            ? "Processing Complete!"
            : status === "error"
              ? "Something Went Wrong"
              : "Processing Your Project"}
        </h1>
        <p className="text-muted font-medium">
          {processConfig.repoName} — {processConfig.selectedFiles.length} files
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-10 p-5 bg-surface/50 border border-foreground/10 rounded-2xl">
        <Progress
          value={progressPercent}
          label={currentStep}
          color={status === "error" ? "bg-primary" : status === "complete" ? "bg-accent-green" : "bg-secondary"}
        />
      </div>

      {/* Steps */}
      <Card className="mb-8 rounded-xl border-foreground/15">
        <CardContent className="py-6">
          <div className="space-y-1">
            {steps.map((step, index) => {
              const isCurrent = !step.done && step.startedAt && status === "processing";
              const isPending = !step.done && !step.startedAt;

              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all",
                    step.done && "bg-accent-green/6",
                    isCurrent && "bg-secondary/8 border border-secondary/25",
                    isPending && "opacity-40"
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`,
                  }}
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {step.done ? (
                      <CheckCircle2 size={22} className="text-accent-green" />
                    ) : isCurrent ? (
                      <Loader2 size={22} className="animate-spin text-secondary" />
                    ) : (
                      <Circle size={22} className="text-muted/30" />
                    )}
                  </div>

                  {/* Label */}
                  <span className={cn(
                    "font-bold text-sm flex-1",
                    step.done && "text-foreground",
                    isCurrent && "text-foreground",
                    isPending && "text-muted"
                  )}>
                    {step.label}
                  </span>

                  {/* Step number */}
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 border rounded-md",
                    step.done
                      ? "text-accent-green bg-accent-green/10 border-accent-green/20"
                      : isCurrent
                        ? "text-secondary bg-secondary/10 border-secondary/20"
                        : "text-muted bg-background border-foreground/10"
                  )}>
                    {index + 1}/{steps.length}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {status === "error" && error && (
        <Card className="mb-8 border-primary/40 bg-primary/5 rounded-xl">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-xl">
                <AlertTriangle size={20} className="text-primary" />
              </div>
              <div>
                <p className="font-bold text-primary mb-1">Processing Error</p>
                <p className="text-sm font-medium text-foreground mb-4">{error}</p>
                <Button onClick={handleRetry} variant="outline" size="sm" className="gap-2 cursor-pointer">
                  <RotateCcw size={14} />
                  Retry
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Complete State */}
      {status === "complete" && steps.every((s) => s.done) && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-green/10 border border-accent-green/25 rounded-full text-sm font-bold text-accent-green mb-6">
            <CheckCircle2 size={16} />
            All steps completed successfully
          </div>
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => router.push("/results")}
              className="gap-2 min-w-[240px] animate-pulse-brutal cursor-pointer"
            >
              View Results <ArrowRight size={18} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
