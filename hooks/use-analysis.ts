"use client";

import { useState, useCallback } from "react";
import type { AnalysisResult, AnalysisStreamEvent } from "@/types/analysis";
import type { RepoFile } from "@/types/github";

type AnalysisStatus = "idle" | "analyzing" | "complete" | "error";

export function useAnalysis() {
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [result, setResult] = useState<Partial<AnalysisResult>>({});
  const [error, setError] = useState("");

  const analyze = useCallback(async (files: RepoFile[]) => {
    setStatus("analyzing");
    setStatusMessage("Starting analysis...");
    setResult({});
    setError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });

      if (!res.ok) {
        throw new Error("Analysis request failed");
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
            const event: AnalysisStreamEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case "status":
                setStatusMessage(event.data as string);
                break;
              case "tech_stack":
                setResult((prev) => ({ ...prev, techStack: event.data as AnalysisResult["techStack"] }));
                break;
              case "architecture":
                setResult((prev) => ({ ...prev, architecture: event.data as AnalysisResult["architecture"] }));
                break;
              case "key_files":
                setResult((prev) => ({ ...prev, keyFiles: event.data as AnalysisResult["keyFiles"] }));
                break;
              case "summary":
                setResult((prev) => ({ ...prev, summary: event.data as string }));
                break;
              case "complete":
                setResult(event.data as AnalysisResult);
                setStatus("complete");
                setStatusMessage("Analysis complete!");
                break;
              case "error":
                throw new Error((event.data as { message: string }).message);
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== "Analysis failed") {
              console.warn("Failed to parse SSE event:", line);
            } else {
              throw parseError;
            }
          }
        }
      }
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Analysis failed");
    }
  }, []);

  return { status, statusMessage, result, error, analyze };
}
