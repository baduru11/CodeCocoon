"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ResourceGroup } from "./resource-card";
import {
  CheckCircle2, ChevronDown, ChevronRight, Clock, Zap,
  Lightbulb, FileCode, BookOpen,
} from "lucide-react";
import type { SkillNode, SkillEdge } from "@/types/learning";

interface LinearPathViewProps {
  nodes: SkillNode[];
  edges: SkillEdge[];
  onNodeClick?: (nodeId: string) => void;
  onMarkComplete: (nodeId: string) => void;
}

/** Topological sort for linear display order */
function topologicalSort(nodes: SkillNode[], edges: SkillEdge[]): SkillNode[] {
  const adjMap = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    adjMap.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    if (adjMap.has(edge.from) && inDegree.has(edge.to)) {
      adjMap.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const next of adjMap.get(current) || []) {
      const newDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  return sorted.map((id) => nodeMap.get(id)!).filter(Boolean);
}

const DIFFICULTY_LABELS_SHORT = ["", "Easy", "Easy", "Medium", "Hard", "Expert"];

export function LinearPathView({ nodes, edges, onMarkComplete }: LinearPathViewProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const sortedNodes = topologicalSort(nodes, edges);

  return (
    <div className="space-y-3">
      {sortedNodes.map((node, i) => {
        const isExpanded = expandedId === node.id;
        const isCompleted = node.status === "completed";

        const prereqNames = node.prerequisites
          .map((pid) => nodes.find((n) => n.id === pid)?.name)
          .filter(Boolean);

        return (
          <div
            key={node.id}
            className={cn(
              "border-2 rounded-xl overflow-hidden transition-all duration-200",
              isCompleted
                ? "border-accent-green/30 bg-accent-green/[0.03]"
                : "border-foreground/15 bg-surface"
            )}
          >
            {/* Header */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : node.id)}
              className="cursor-pointer w-full text-left p-4 flex items-center gap-3"
            >
              {/* Step indicator */}
              <div
                className={cn(
                  "shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2",
                  isCompleted
                    ? "bg-accent-green/10 border-accent-green text-accent-green"
                    : "bg-primary/10 border-primary/30 text-primary"
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <span className="text-sm font-bold">{i + 1}</span>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">
                  {node.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted font-medium flex items-center gap-1">
                    <Zap size={10} />
                    {DIFFICULTY_LABELS_SHORT[node.difficulty] || "Medium"}
                  </span>
                  <span className="text-xs text-muted font-medium flex items-center gap-1">
                    <Clock size={10} />
                    {node.estimatedMinutes} min
                  </span>
                  <Badge className="text-[10px] capitalize" variant="default">
                    {node.category}
                  </Badge>
                </div>
              </div>

              {isExpanded ? (
                <ChevronDown size={18} className="shrink-0 text-muted" />
              ) : (
                <ChevronRight size={18} className="shrink-0 text-muted" />
              )}
            </button>

            {/* Prerequisite badges */}
            {prereqNames.length > 0 && !isExpanded && (
              <div className="px-4 pb-3 -mt-1">
                <span className="text-xs text-muted font-medium">Requires: </span>
                {prereqNames.map((name) => (
                  <span
                    key={name}
                    className="inline-block text-xs font-bold px-2 py-0.5 rounded-md bg-foreground/5 border border-foreground/10 mr-1"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-5 pt-0 border-t-2 border-foreground/8 space-y-5">
                {node.explanation && (
                  <section className="pt-4">
                    <h4 className="flex items-center gap-1.5 text-sm font-bold mb-2">
                      <Lightbulb size={14} className="text-accent-yellow" />
                      What is this?
                    </h4>
                    <p className="text-sm text-foreground/70 font-medium leading-relaxed">
                      {node.explanation}
                    </p>
                  </section>
                )}

                {node.inYourCodebase && (
                  <section>
                    <h4 className="flex items-center gap-1.5 text-sm font-bold mb-2">
                      <FileCode size={14} className="text-primary" />
                      In Your Codebase
                    </h4>
                    <div className="p-3 bg-foreground/[0.03] border-2 border-foreground/8 rounded-xl">
                      <p className="text-sm text-foreground/60 font-medium leading-relaxed">
                        {node.inYourCodebase}
                      </p>
                    </div>
                  </section>
                )}

                {node.keyTakeaways.length > 0 && (
                  <section>
                    <h4 className="flex items-center gap-1.5 text-sm font-bold mb-2">
                      <BookOpen size={14} className="text-accent-green" />
                      Key Takeaways
                    </h4>
                    <ul className="space-y-1.5">
                      {node.keyTakeaways.map((t, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-foreground/70 font-medium leading-relaxed">
                          <span className="text-accent-green shrink-0 mt-0.5">•</span>
                          {t}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {node.resources.length > 0 && (
                  <section>
                    <h4 className="text-sm font-bold mb-2">Learning Resources</h4>
                    <ResourceGroup resources={node.resources} />
                  </section>
                )}

                {/* Action */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onMarkComplete(node.id);
                  }}
                  className={cn(
                    "cursor-pointer w-full py-3 rounded-xl border-2 text-sm font-bold transition-all duration-200",
                    isCompleted
                      ? "border-foreground/15 text-muted hover:border-foreground/30"
                      : "border-primary bg-primary/5 text-primary hover:bg-primary/10"
                  )}
                >
                  {isCompleted ? "Mark as Incomplete" : "Mark as Complete"}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
