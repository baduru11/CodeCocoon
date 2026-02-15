"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, bytesToSize, getLanguageFromExtension, getFileExtension } from "@/lib/utils";
import {
  Loader2, FileCode, ArrowRight, AlertTriangle, CheckSquare, Square,
  MinusSquare,
} from "lucide-react";
import type { FetchTreeResult, ProcessConfig, TreePreviewFile } from "@/types/github";
import { SKILL_LEVEL_OPTIONS, FILE_SIZE_WARNING_BYTES } from "@/lib/constants";

export default function ConfigurePage() {
  const router = useRouter();
  const { value: treeData, isLoaded } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const { setValue: setProcessConfig } = useLocalStorage<ProcessConfig | null>("processConfig", null);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [skillLevel, setSkillLevel] = useState<ProcessConfig["skillLevel"] | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Redirect if no tree data
  useEffect(() => {
    if (isLoaded && !treeData) {
      router.push("/connect");
    }
  }, [isLoaded, treeData, router]);

  // Sort files by size descending
  const sortedFiles = useMemo(() => {
    if (!treeData) return [];
    return [...treeData.files].sort((a, b) => b.size - a.size);
  }, [treeData]);

  // Initialize selection: exclude large files, include the rest
  useEffect(() => {
    if (sortedFiles.length > 0 && !initialized) {
      const initial = new Set<string>();
      for (const file of sortedFiles) {
        if (file.size < FILE_SIZE_WARNING_BYTES && !file.excluded) {
          initial.add(file.path);
        }
      }
      setSelectedPaths(initial);
      setInitialized(true);
    }
  }, [sortedFiles, initialized]);

  const isLargeFile = (file: TreePreviewFile) => file.size >= FILE_SIZE_WARNING_BYTES;

  const selectedFiles = useMemo(
    () => sortedFiles.filter((f) => selectedPaths.has(f.path)),
    [sortedFiles, selectedPaths]
  );

  const totalSelectedSize = useMemo(
    () => selectedFiles.reduce((sum, f) => sum + f.size, 0),
    [selectedFiles]
  );

  const allSelected = sortedFiles.length > 0 && selectedPaths.size === sortedFiles.length;
  const noneSelected = selectedPaths.size === 0;

  const toggleFile = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(sortedFiles.map((f) => f.path)));
    }
  };

  const handleSubmit = () => {
    if (!treeData || selectedFiles.length === 0 || !skillLevel) return;

    const config: ProcessConfig = {
      owner: treeData.owner,
      repo: treeData.repo,
      selectedFiles,
      skillLevel,
      repoName: treeData.repoName,
    };

    setProcessConfig(config);
    router.push("/processing");
  };

  const canSubmit = selectedFiles.length > 0 && skillLevel !== null;

  if (!isLoaded || !treeData) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-2">Configure Analysis</h1>
        <p className="text-muted font-medium text-lg">
          {treeData.repoName} — {treeData.totalFiles} files found
        </p>
      </div>

      {/* Skill Level Selection */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your Skill Level</CardTitle>
          <CardDescription>This personalizes the learning content to your experience</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {SKILL_LEVEL_OPTIONS.map((option) => {
              const isSelected = skillLevel === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setSkillLevel(option.value)}
                  className={cn(
                    "text-left p-5 rounded-[4px] transition-all",
                    isSelected
                      ? "bg-surface border-3 border-foreground shadow-[5px_5px_0px_0px_#1A1A1A]"
                      : "bg-surface border-2 border-foreground/20 hover:border-foreground/50"
                  )}
                >
                  <div className="text-3xl mb-2">{option.emoji}</div>
                  <div className="font-bold text-base mb-1">{option.label}</div>
                  <div className="text-xs text-muted font-medium leading-relaxed">
                    {option.description}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* File Selection */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileCode size={20} />
                Select Files
              </CardTitle>
              <CardDescription className="mt-1">
                Choose which files to include in the analysis
              </CardDescription>
            </div>
            <button
              onClick={toggleAll}
              className="flex items-center gap-2 text-sm font-bold text-foreground hover:text-primary transition-colors"
            >
              {allSelected ? (
                <MinusSquare size={18} />
              ) : (
                <CheckSquare size={18} />
              )}
              {allSelected ? "Deselect All" : "Select All"}
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Summary bar */}
          <div className="flex items-center justify-between mb-4 p-3 bg-background border-2 border-foreground/20 rounded-[4px]">
            <span className="font-bold text-sm">
              {selectedFiles.length} file{selectedFiles.length !== 1 ? "s" : ""} selected
            </span>
            <Badge variant={totalSelectedSize > 500_000 ? "warning" : "success"}>
              {bytesToSize(totalSelectedSize)}
            </Badge>
          </div>

          {/* File list */}
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {sortedFiles.map((file) => {
              const isSelected = selectedPaths.has(file.path);
              const isLarge = isLargeFile(file);
              const ext = getFileExtension(file.path);
              const lang = ext ? getLanguageFromExtension(ext) : "Unknown";

              return (
                <button
                  key={file.path}
                  onClick={() => toggleFile(file.path)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-[4px] transition-all",
                    isSelected
                      ? "bg-accent-green/10 border-2 border-accent-green/40"
                      : "bg-surface border-2 border-transparent hover:border-foreground/20",
                    isLarge && !isSelected && "bg-accent-yellow/10 border-accent-yellow/40"
                  )}
                >
                  {isSelected ? (
                    <CheckSquare size={16} className="text-accent-green shrink-0" />
                  ) : (
                    <Square size={16} className="text-muted shrink-0" />
                  )}

                  <span className="font-mono text-xs truncate flex-1">{file.path}</span>

                  <div className="flex items-center gap-2 shrink-0">
                    {isLarge && (
                      <AlertTriangle size={14} className="text-accent-yellow" />
                    )}
                    <span className="text-[10px] font-bold text-muted bg-background px-1.5 py-0.5 border border-foreground/15 rounded-[2px]">
                      {lang}
                    </span>
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 border rounded-[2px]",
                      isLarge
                        ? "text-accent-yellow border-accent-yellow/40 bg-accent-yellow/10"
                        : "text-muted border-foreground/15 bg-background"
                    )}>
                      {bytesToSize(file.size)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Large file warning */}
          {sortedFiles.some(isLargeFile) && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-accent-yellow/10 border-2 border-accent-yellow/30 rounded-[4px]">
              <AlertTriangle size={16} className="text-accent-yellow shrink-0 mt-0.5" />
              <p className="text-xs font-medium text-foreground">
                Files over {bytesToSize(FILE_SIZE_WARNING_BYTES)} are highlighted and pre-excluded.
                You can still include them if needed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-center">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="gap-2 min-w-[240px]"
        >
          Start Analysis <ArrowRight size={18} />
        </Button>
      </div>
      {!canSubmit && (
        <p className="text-center text-xs text-muted font-medium mt-3">
          {noneSelected && !skillLevel
            ? "Select files and a skill level to continue"
            : noneSelected
              ? "Select at least one file to continue"
              : "Choose a skill level to continue"}
        </p>
      )}
    </div>
  );
}
