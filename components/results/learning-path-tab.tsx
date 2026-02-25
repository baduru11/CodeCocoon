"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  MousePointerClick,
} from "lucide-react";
import type {
  LearningPath,
  LearningPathV1,
  LearningPathV2,
  SkillNode,
} from "@/types/learning";
import { isV2LearningPath } from "@/types/learning";
import { SkillTree } from "./skill-tree";
import { LearningDashboard } from "./learning-dashboard";
import { ConceptDetailInline } from "./concept-detail-panel";
import { LinearPathView } from "./linear-path-view";

interface LearningPathTabProps {
  learningPath: LearningPath | null | undefined;
}

export function LearningPathTab({ learningPath }: LearningPathTabProps) {
  if (!learningPath) {
    return (
      <div className="text-center py-16">
        <GraduationCap size={48} className="mx-auto mb-4 text-muted" />
        <p className="text-lg font-bold text-muted">No learning path available.</p>
        <p className="text-sm text-muted mt-1">
          Run a skill assessment first to generate a personalized learning path.
        </p>
      </div>
    );
  }

  if (isV2LearningPath(learningPath)) {
    return <V2LearningPathView learningPath={learningPath} />;
  }

  return <V1LearningPathView learningPath={learningPath as LearningPathV1} />;
}

// ─── V2 Skill Tree View ────────────────────────────────────────────

function V2LearningPathView({ learningPath }: { learningPath: LearningPathV2 }) {
  // All nodes start as "ready" — completion only happens via user interaction
  const [nodes, setNodes] = useState<SkillNode[]>(() =>
    learningPath.nodes.map((n) => ({ ...n, status: "ready" as const }))
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const detailRef = useRef<HTMLDivElement>(null);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) || null
    : null;

  // Scroll to detail panel when a node is selected
  useEffect(() => {
    if (selectedNode && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selectedNode]);

  const handleMarkComplete = useCallback((nodeId: string) => {
    setNodes((prev) =>
      prev.map((node) => {
        if (node.id !== nodeId) return node;
        return {
          ...node,
          status: node.status === "completed" ? "ready" : "completed",
        } as SkillNode;
      })
    );
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const handleNavigateToNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Update learning path with current node states for dashboard
  const currentLearningPath: LearningPathV2 = {
    ...learningPath,
    nodes,
    completedConcepts: nodes.filter((n) => n.status === "completed").length,
  };

  return (
    <div className="space-y-10">
      {/* Dashboard: role, progress, gap analysis, module grid */}
      <LearningDashboard
        learningPath={currentLearningPath}
        onModuleClick={(moduleId) => {
          // Find first node in this module and select it
          const mod = learningPath.modules.find((m) => m.id === moduleId);
          if (mod && mod.nodeIds.length > 0) {
            setSelectedNodeId(mod.nodeIds[0]);
          }
        }}
      />

      {/* Desktop: Interactive skill tree */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between mb-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-muted uppercase tracking-wide">
            <GitBranch size={16} />
            Skill Tree
          </h3>
          <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
            <MousePointerClick size={14} />
            Click a node to view details
          </span>
        </div>
        <SkillTree
          nodes={nodes}
          edges={learningPath.edges}
          modules={learningPath.modules}
          onNodeClick={handleNodeClick}
        />
      </div>

      {/* Mobile: Linear path view */}
      <div className="md:hidden">
        <h3 className="flex items-center gap-2 text-sm font-bold text-muted uppercase tracking-wide mb-4">
          <GitBranch size={16} />
          Learning Path
        </h3>
        <LinearPathView
          nodes={nodes}
          edges={learningPath.edges}
          onNodeClick={handleNodeClick}
          onMarkComplete={handleMarkComplete}
        />
      </div>

      {/* Concept detail inline (below tree) */}
      {selectedNode && (
        <div ref={detailRef}>
          <ConceptDetailInline
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onMarkComplete={handleMarkComplete}
            onNavigateToNode={handleNavigateToNode}
            allNodes={nodes}
          />
        </div>
      )}
    </div>
  );
}

// ─── V1 Accordion View (backward compat) ────────────────────────────

function V1LearningPathView({ learningPath }: { learningPath: LearningPathV1 }) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) { next.delete(moduleId); } else { next.add(moduleId); }
      return next;
    });
  };

  if (!learningPath.modules || learningPath.modules.length === 0) {
    return (
      <div className="text-center py-16">
        <GraduationCap size={48} className="mx-auto mb-4 text-muted" />
        <p className="text-lg font-bold text-muted">No learning path available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-1">
          <GraduationCap size={20} />
          {learningPath.title}
        </h2>
        {learningPath.description && (
          <p className="text-sm text-muted font-medium">{learningPath.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="secondary">{learningPath.modules.length} modules</Badge>
          <Badge variant="default">{learningPath.totalLessons} lessons</Badge>
          {learningPath.skillLevel && (
            <Badge variant="warning" className="capitalize">{learningPath.skillLevel}</Badge>
          )}
        </div>
      </div>

      {/* Modules */}
      <div className="space-y-4">
        {learningPath.modules.map((mod, mi) => {
          const isExpanded = expandedModules.has(mod.id);
          const accentColors = [
            "border-l-primary",
            "border-l-secondary",
            "border-l-accent-yellow",
            "border-l-accent-green",
            "border-l-accent-purple",
          ];
          const accentColor = accentColors[mi % accentColors.length];

          return (
            <Card key={mod.id} className={cn("border-2 border-foreground/15 overflow-hidden border-l-[5px]", accentColor)}>
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white bg-foreground px-2 py-0.5 rounded-md">
                      M{mi + 1}
                    </span>
                    <Badge variant="default" className="text-xs">
                      {mod.techStack}
                    </Badge>
                    <span className="text-xs text-muted font-medium">
                      {mod.lessons.length} lesson{mod.lessons.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-base font-bold">{mod.title}</p>
                  <p className="text-sm text-muted font-medium mt-0.5">{mod.description}</p>
                </div>
                {isExpanded ? (
                  <ChevronDown size={18} className="shrink-0 text-muted ml-3" />
                ) : (
                  <ChevronRight size={18} className="shrink-0 text-muted ml-3" />
                )}
              </button>

              {isExpanded && (
                <CardContent className="pt-0 pb-4 border-t-2 border-foreground/10">
                  <div className="space-y-4 mt-4">
                    {mod.lessons.map((lesson, li) => (
                      <div
                        key={lesson.id}
                        className={cn(
                          "p-3 rounded-xl border border-foreground/10",
                          "hover:border-foreground/20 transition-colors"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full bg-secondary text-white text-xs font-bold border-2 border-secondary">
                            {li + 1}
                          </span>
                          <p className="text-sm font-bold">{lesson.title}</p>
                        </div>
                        <p className="text-xs text-muted font-medium ml-8">
                          {lesson.description}
                        </p>
                        {lesson.keyConceptsFromCode && (
                          <p className="text-xs text-secondary/80 font-medium ml-8 mt-1 italic">
                            From your code: {lesson.keyConceptsFromCode}
                          </p>
                        )}
                        {lesson.resources.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 ml-8">
                            {lesson.resources.map((res, ri) => (
                              <a
                                key={ri}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5",
                                  "rounded-lg border border-foreground/15 bg-surface",
                                  "text-secondary hover:bg-secondary/10 hover:border-secondary/30",
                                  "transition-all duration-200 cursor-pointer"
                                )}
                              >
                                <ExternalLink size={10} />
                                {res.source}
                                <span className="text-muted font-medium">· {res.type}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
