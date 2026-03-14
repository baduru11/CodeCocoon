"use client";

import { useState, useCallback, useRef } from "react";
import type { AnalysisResult } from "@/types/analysis";
import type { LearningPath } from "@/types/learning";
import type { Exercise } from "@/types/exercise";
import type { ProcessConfig, FetchRepoResult } from "@/types/github";
import type {
  TutorialAbstraction,
  TutorialRelationships,
  TutorialChapter,
  TutorialData,
} from "@/types/tutorial";
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
  ragProjectId?: string;
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
      // Build request body — for uploads, include file contents directly
      const requestBody: Record<string, unknown> = {
        owner: config.owner,
        repo: config.repo,
        selectedFiles: config.selectedFiles.map((f) => ({
          path: f.path,
          sha: f.sha,
          size: f.size,
        })),
        skillLevel: config.skillLevel,
        role: config.role || null,
      };

      if (config.isUpload) {
        try {
          const stored = localStorage.getItem("projectData");
          if (stored) {
            const projectData = JSON.parse(stored) as FetchRepoResult;
            requestBody.uploadedFiles = projectData.files;
          }
        } catch {
          // Fall through — server will attempt GitHub fetch as fallback
        }
      }

      const res = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(data.error || "Processing request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      const processLine = (line: string) => {
        if (!line.startsWith("data: ")) return;

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
            case "indexing":
              markStepDone("indexing");
              break;
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
            case "tutorial_abstractions":
              markStepDone("tutorial_abstractions");
              setResults((prev) => ({
                ...prev,
                analysis: {
                  ...prev.analysis,
                  tutorial: {
                    ...prev.analysis?.tutorial,
                    abstractions: event.data as TutorialAbstraction[],
                  } as TutorialData,
                },
              }));
              break;
            case "tutorial_relationships":
              markStepDone("tutorial_relationships");
              setResults((prev) => ({
                ...prev,
                analysis: {
                  ...prev.analysis,
                  tutorial: {
                    ...prev.analysis?.tutorial,
                    relationships: event.data as TutorialRelationships,
                  } as TutorialData,
                },
              }));
              break;
            case "tutorial_order":
              markStepDone("tutorial_order");
              setResults((prev) => ({
                ...prev,
                analysis: {
                  ...prev.analysis,
                  tutorial: {
                    ...prev.analysis?.tutorial,
                    chapterOrder: event.data as number[],
                  } as TutorialData,
                },
              }));
              break;
            case "tutorial_chapter": {
              const { chapterNum, total, chapter } = event.data as {
                chapterNum: number;
                total: number;
                chapter: TutorialChapter;
              };
              setResults((prev) => {
                const existing = prev.analysis?.tutorial?.chapters ?? [];
                return {
                  ...prev,
                  analysis: {
                    ...prev.analysis,
                    tutorial: {
                      ...prev.analysis?.tutorial,
                      chapters: [...existing, chapter],
                    } as TutorialData,
                  },
                };
              });
              if (chapterNum === total) {
                markStepDone("tutorial_chapters");
              }
              break;
            }
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
            case "learning_concepts":
              markStepDone("learning_concepts");
              break;
            case "learning_graph":
              markStepDone("learning_graph");
              break;
            case "learning_lessons":
              markStepDone("learning_lessons");
              break;
            case "learning_resources":
              markStepDone("learning_resources");
              break;
            case "learning_path":
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
                  ragProjectId: completeData.ragProjectId ?? prev.ragProjectId,
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
          // Re-throw application errors (thrown from the "error" event case above).
          // Only swallow JSON parse failures on malformed SSE lines.
          if (parseError instanceof SyntaxError) {
            console.warn("Failed to parse SSE event:", line);
          } else {
            throw parseError;
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          processLine(line);
        }
      }

      // Flush any remaining data left in the buffer after stream ends
      if (buffer.trim()) {
        processLine(buffer.trim());
      }

      // If we finished reading without a complete event, treat as error
      // since the stream ended before all steps were done
      if (!completedRef.current) {
        setStatus("error");
        setError("Processing stream ended unexpectedly. Please try again.");
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
