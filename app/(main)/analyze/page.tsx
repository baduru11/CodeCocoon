"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import type { AnalysisResult } from "@/types/analysis";

export default function AnalyzePage() {
  const router = useRouter();
  const { value: analysisData, isLoaded } = useLocalStorage<AnalysisResult | null>("analysisData", null);
  useEffect(() => {
    if (isLoaded) router.replace(analysisData ? "/results" : "/connect");
  }, [isLoaded, analysisData, router]);
  return null;
}
