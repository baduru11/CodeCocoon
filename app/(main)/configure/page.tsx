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
  MinusSquare, Filter, Info, ChevronDown, ChevronRight,
} from "lucide-react";
import type { FetchTreeResult, ProcessConfig, TreePreviewFile, FilterReason } from "@/types/github";
import { SKILL_LEVEL_OPTIONS, FILE_SIZE_WARNING_BYTES } from "@/lib/constants";

export default function ConfigurePage() {
  const router = useRouter();
  const { value: treeData, isLoaded } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const { setValue: setProcessConfig } = useLocalStorage<ProcessConfig | null>("processConfig", null);

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [skillLevel, setSkillLevel] = useState<ProcessConfig["skillLevel"] | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showFiltered, setShowFiltered] = useState(false);
  const [filterReasonFilter, setFilterReasonFilter] = useState<FilterReason | "all">("all");

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

  // Group excluded files by reason
  const excludedByReason = useMemo((): Record<FilterReason, TreePreviewFile[]> => {
    if (!treeData?.excludedFiles) return { too_large: [], binary_file: [], ignored_directory: [], unsupported_extension: [], non_file: [] };
    const groups: Record<FilterReason, TreePreviewFile[]> = {
      too_large: [],
      binary_file: [],
      ignored_directory: [],
      unsupported_extension: [],
      non_file: [],
    };
    for (const file of treeData.excludedFiles) {
      if (file.filterReason) {
        groups[file.filterReason].push(file);
      }
    }
    return groups;
  }, [treeData]);

  // Filter excluded files based on selected reason
  const filteredExcludedFiles = useMemo(() => {
    if (!treeData?.excludedFiles) return [];
    if (filterReasonFilter === "all") return treeData.excludedFiles;
    return treeData.excludedFiles.filter((f) => f.filterReason === filterReasonFilter);
  }, [treeData, filterReasonFilter]);

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

  const includeFilteredFile = (file: TreePreviewFile) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      next.add(file.path);
      return next;
    });
  };

  const includeAllFiltered = () => {
    if (!treeData?.excludedFiles) return;
    const filesToInclude = filterReasonFilter === "all"
      ? treeData.excludedFiles
      : treeData.excludedFiles.filter((f) => f.filterReason === filterReasonFilter);

    setSelectedPaths((prev) => {
      const next = new Set(prev);
      for (const file of filesToInclude) {
        next.add(file.path);
      }
      return next;
    });
  };

  const getFilterReasonLabel = (reason: FilterReason): string => {
    const labels: Record<FilterReason, string> = {
      too_large: "Too Large",
      binary_file: "Binary File",
      ignored_directory: "Ignored Directory",
      unsupported_extension: "Unsupported Extension",
      non_file: "Not a File",
    };
    return labels[reason];
  };

  const getFilterReasonColor = (reason: FilterReason): string => {
    const colors: Record<FilterReason, string> = {
      too_large: "bg-accent-yellow/10 border-accent-yellow/40 text-accent-yellow",
      binary_file: "bg-accent-purple/10 border-accent-purple/40 text-accent-purple",
      ignored_directory: "bg-accent-orange/10 border-accent-orange/40 text-accent-orange",
      unsupported_extension: "bg-primary/10 border-primary/40 text-primary",
      non_file: "bg-muted/10 border-muted/40 text-muted",
    };
    return colors[reason];
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

      {/* Filtered Files Section */}
      {treeData.excludedFiles && treeData.excludedFiles.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <button
              onClick={() => setShowFiltered(!showFiltered)}
              className="flex items-center justify-between w-full text-left hover:opacity-70 transition-opacity"
            >
              <div className="flex items-center gap-2">
                <Filter size={20} />
                <CardTitle>
                  Filtered Files ({treeData.totalExcludedFiles.toLocaleString()})
                </CardTitle>
                {showFiltered ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </div>
            </button>
            <CardDescription>
              Files automatically filtered during scanning. Click to expand and review.
            </CardDescription>
          </CardHeader>

          {showFiltered && (
            <CardContent>
              {/* Info Banner */}
              <div className="mb-4 flex items-start gap-2 p-3 bg-accent-green/10 border-2 border-accent-green/30 rounded-[4px]">
                <Info size={16} className="text-accent-green shrink-0 mt-0.5" />
                <div className="text-xs font-medium text-foreground">
                  <p className="mb-1">
                    Files are filtered to help focus analysis on source code. You can include any filtered file by clicking &ldquo;Include&rdquo; below.
                  </p>
                  <p className="text-muted">
                    Common filters: large files (&gt;100KB), binaries (images, fonts), generated code (node_modules, dist), and unsupported file types.
                  </p>
                </div>
              </div>

              {/* Filter Reason Badges */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setFilterReasonFilter("all")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold border-2 rounded-[4px] transition-all",
                    filterReasonFilter === "all"
                      ? "bg-foreground text-background border-foreground"
                      : "bg-surface text-foreground border-foreground/20 hover:border-foreground/50"
                  )}
                >
                  All ({treeData.totalExcludedFiles.toLocaleString()})
                </button>
                {(Object.keys(excludedByReason) as FilterReason[]).map((reason) => {
                  const count = excludedByReason[reason]?.length || 0;
                  if (count === 0) return null;
                  return (
                    <button
                      key={reason}
                      onClick={() => setFilterReasonFilter(reason)}
                      className={cn(
                        "px-3 py-1.5 text-xs font-bold border-2 rounded-[4px] transition-all",
                        filterReasonFilter === reason
                          ? getFilterReasonColor(reason)
                          : "bg-surface text-foreground border-foreground/20 hover:border-foreground/50"
                      )}
                    >
                      {getFilterReasonLabel(reason)} ({count.toLocaleString()})
                    </button>
                  );
                })}
              </div>

              {/* Bulk Action */}
              {filteredExcludedFiles.length > 0 && (
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={includeAllFiltered}
                    className="gap-2"
                  >
                    <CheckSquare size={14} />
                    Include All {filterReasonFilter !== "all" ? getFilterReasonLabel(filterReasonFilter) : ""} Files
                  </Button>
                </div>
              )}

              {/* Performance Warning */}
              {treeData.totalExcludedFiles > 10000 && (
                <div className="mb-4 flex items-start gap-2 p-3 bg-accent-yellow/10 border-2 border-accent-yellow/30 rounded-[4px]">
                  <AlertTriangle size={16} className="text-accent-yellow shrink-0 mt-0.5" />
                  <p className="text-xs font-medium text-foreground">
                    This repository has {treeData.totalExcludedFiles.toLocaleString()} filtered files. Only the first 1,000 are shown below for performance.
                  </p>
                </div>
              )}

              {/* File List */}
              <div className="max-h-[400px] overflow-y-auto space-y-1">
                {filteredExcludedFiles.map((file) => {
                  const isSelected = selectedPaths.has(file.path);
                  const ext = getFileExtension(file.path);
                  const lang = ext ? getLanguageFromExtension(ext) : "Unknown";

                  return (
                    <div
                      key={file.path}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-[4px] border-2",
                        isSelected
                          ? "bg-accent-green/10 border-accent-green/40"
                          : "bg-surface border-foreground/10"
                      )}
                    >
                      <span className="font-mono text-xs truncate flex-1" title={file.path}>
                        {file.path}
                      </span>

                      <div className="flex items-center gap-2 shrink-0">
                        {file.filterReason && (
                          <span
                            className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 border-2 rounded-[2px]",
                              getFilterReasonColor(file.filterReason)
                            )}
                            title={file.filterDetails}
                          >
                            {getFilterReasonLabel(file.filterReason)}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-muted bg-background px-1.5 py-0.5 border border-foreground/15 rounded-[2px]">
                          {lang}
                        </span>
                        <span className="text-[10px] font-bold text-muted bg-background px-1.5 py-0.5 border border-foreground/15 rounded-[2px]">
                          {bytesToSize(file.size)}
                        </span>
                        {isSelected ? (
                          <button
                            onClick={() => toggleFile(file.path)}
                            className="text-xs font-bold text-accent-green hover:text-accent-green/70 transition-colors px-2 py-1"
                          >
                            Remove
                          </button>
                        ) : (
                          <button
                            onClick={() => includeFilteredFile(file)}
                            className="text-xs font-bold text-primary hover:text-primary/70 transition-colors px-2 py-1"
                          >
                            Include
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {filteredExcludedFiles.length === 0 && (
                <p className="text-center text-sm text-muted font-medium py-4">
                  No files match the selected filter.
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

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
