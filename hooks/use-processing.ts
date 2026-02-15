"use client";

import { useState, useCallback, useRef } from "react";
import type { AnalysisResult } from "@/types/analysis";
import type { LearningPath } from "@/types/learning";
import type { Exercise } from "@/types/exercise";
import type { ProcessConfig, FetchRepoResult } from "@/types/github";
import { PROCESSING_STEPS } from "@/lib/constants";

type ProcessingStatus = "idle" | "processing" | "complete" | "error";

interface ProcessingStep {
  key: string;
  label: string;
  done: boolean;
  startedAt?: number;
  completedAt?: number;
}

export interface ProcessingResults {
  projectData?: FetchRepoResult;
  analysis?: Partial<AnalysisResult>;
  learningPath?: LearningPath;
  exercises?: Exercise[];
}

export function useProcessing() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [currentStep, setCurrentStep] = useState("");
  const [steps, setSteps] = useState<ProcessingStep[]>(
    PROCESSING_STEPS.map((s) => ({ ...s, done: false }))
  );
  const [results, setResults] = useState<ProcessingResults>({});
  const [error, setError] = useState("");
  const completedRef = useRef(false);

  const markStepDone = useCallback((key: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, done: true, completedAt: Date.now() } : s
      )
    );
  }, []);

  const markStepStarted = useCallback((key: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.key === key ? { ...s, startedAt: Date.now() } : s
      )
    );
  }, []);

  const process = useCallback(async (config: ProcessConfig) => {
    setStatus("processing");
    setCurrentStep("Initializing...");
    setResults({});
    setError("");
    setSteps(PROCESSING_STEPS.map((s) => ({ ...s, done: false })));
    completedRef.current = false;

    try {
      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: config.owner,
          repo: config.repo,
          selectedFiles: config.selectedFiles.map((f) => ({
            path: f.path,
            sha: f.sha,
            size: f.size,
          })),
          skillLevel: config.skillLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(data.error || "Processing request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "status":
                setCurrentStep(event.data as string);
                break;
              case "step_start": {
                const startKey = event.data as string;
                markStepStarted(startKey);
                break;
              }
              case "files_fetched":
                markStepDone("files_fetched");
                setResults((prev) => ({
                  ...prev,
                  projectData: event.data as FetchRepoResult,
                }));
                break;
              case "tech_stack":
                markStepDone("tech_stack");
                setResults((prev) => ({
                  ...prev,
                  analysis: {
                    ...prev.analysis,
                    techStack: event.data as AnalysisResult["techStack"],
                  },
                }));
                break;
              case "architecture":
                markStepDone("architecture");
                setResults((prev) => ({
                  ...prev,
                  analysis: {
                    ...prev.analysis,
                    architecture: event.data as AnalysisResult["architecture"],
                  },
                }));
                break;
              case "key_files":
                markStepDone("key_files");
                setResults((prev) => ({
                  ...prev,
                  analysis: {
                    ...prev.analysis,
                    keyFiles: event.data as AnalysisResult["keyFiles"],
                  },
                }));
                break;
              case "summary":
                markStepDone("summary");
                setResults((prev) => ({
                  ...prev,
                  analysis: {
                    ...prev.analysis,
                    summary: event.data as string,
                  },
                }));
                break;
              case "learning_path":
                markStepDone("learning_path");
                setResults((prev) => ({
                  ...prev,
                  learningPath: event.data as LearningPath,
                }));
                break;
              case "exercises":
                markStepDone("exercises");
                setResults((prev) => ({
                  ...prev,
                  exercises: event.data as Exercise[],
                }));
                break;
              case "complete":
                completedRef.current = true;
                setStatus("complete");
                setCurrentStep("Complete!");
                // Merge complete event data with incrementally-built results
                // to ensure no data is lost if the complete payload is partial
                if (event.data) {
                  const completeData = event.data as ProcessingResults;
                  setResults((prev) => ({
                    projectData: completeData.projectData ?? prev.projectData,
                    analysis: completeData.analysis ?? prev.analysis,
                    learningPath: completeData.learningPath ?? prev.learningPath,
                    exercises: completeData.exercises ?? prev.exercises,
                  }));
                }
                break;
              case "error":
                throw new Error(
                  (event.data as { message: string }).message || "Processing failed"
                );
            }
          } catch (parseError) {
            if (
              parseError instanceof Error &&
              parseError.message !== "Processing failed"
            ) {
              console.warn("Failed to parse SSE event:", line);
            } else {
              throw parseError;
            }
          }
        }
      }

      // If we finished reading without a complete event, mark as complete
      // Uses ref to avoid stale closure issue with status state
      if (!completedRef.current) {
        completedRef.current = true;
        setStatus("complete");
        setCurrentStep("Complete!");
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Processing failed");
    }
  }, [markStepDone, markStepStarted]);

  const completedSteps = steps.filter((s) => s.done).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  return {
    status,
    currentStep,
    steps,
    results,
    error,
    process,
    completedSteps,
    progressPercent,
  };
}
