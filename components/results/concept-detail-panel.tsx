"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ResourceGroup } from "./resource-card";
import {
  X, CheckCircle2, Clock, Zap, FileCode, Lightbulb, BookOpen,
} from "lucide-react";
import type { SkillNode } from "@/types/learning";

interface ConceptDetailInlineProps {
  node: SkillNode;
  onClose: () => void;
  onMarkComplete: (nodeId: string) => void;
  onNavigateToNode: (nodeId: string) => void;
  allNodes: SkillNode[];
}

const DIFFICULTY_LABELS = ["", "Very Easy", "Easy", "Moderate", "Hard", "Very Hard"];

const CATEGORY_COLORS: Record<string, string> = {
  language: "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30",
  framework: "bg-primary/10 text-primary border-primary/30",
  pattern: "bg-accent-purple/10 text-accent-purple border-accent-purple/30",
  tooling: "bg-accent-green/10 text-accent-green border-accent-green/30",
  architecture: "bg-secondary/10 text-secondary border-secondary/30",
  library: "bg-accent-orange/10 text-accent-orange border-accent-orange/30",
};

const CATEGORY_BORDER_COLORS: Record<string, string> = {
  language: "#F59E0B",
  framework: "#4F46E5",
  pattern: "#8B5CF6",
  tooling: "#10B981",
  architecture: "#0D9488",
  library: "#F97316",
};

export function ConceptDetailInline({
  node,
  onClose,
  onMarkComplete,
  onNavigateToNode,
  allNodes,
}: ConceptDetailInlineProps) {
  const prereqNodes = node.prerequisites
    .map((pid) => allNodes.find((n) => n.id === pid))
    .filter(Boolean) as SkillNode[];

  const isCompleted = node.status === "completed";
  const categoryColor = CATEGORY_COLORS[node.category] || CATEGORY_COLORS.framework;

  return (
    <Card className="border-2 border-foreground/15 overflow-hidden shadow-[3px_3px_0px_0px_#1E293B10]">
      {/* Header */}
      <div
        className="flex items-start justify-between gap-4 p-6 border-b-2 border-foreground/10"
        style={{ borderLeftWidth: 5, borderLeftColor: CATEGORY_BORDER_COLORS[node.category] || "#4F46E5" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={cn("text-xs", categoryColor)}>
              {node.category}
            </Badge>
            {isCompleted && (
              <Badge variant="success" className="text-xs">
                <CheckCircle2 size={12} className="mr-1" /> Completed
              </Badge>
            )}
          </div>
          <h2 className="text-xl font-bold leading-tight">{node.name}</h2>
          <div className="flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-sm text-muted font-medium">
              <Zap size={14} />
              {DIFFICULTY_LABELS[node.difficulty] || `Level ${node.difficulty}`}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted font-medium">
              <Clock size={14} />
              {node.estimatedMinutes} min
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="cursor-pointer p-2 rounded-lg hover:bg-foreground/5 transition-colors shrink-0 border border-foreground/10"
        >
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="p-6 space-y-7">
        {/* Explanation */}
        {node.explanation && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
              <span className="w-6 h-6 rounded-md bg-accent-yellow/10 flex items-center justify-center">
                <Lightbulb size={14} className="text-accent-yellow" />
              </span>
              What is this?
            </h3>
            <p className="text-sm text-foreground/80 font-medium leading-relaxed">
              {node.explanation}
            </p>
          </section>
        )}

        {/* In Your Codebase */}
        {node.inYourCodebase && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
              <span className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                <FileCode size={14} className="text-primary" />
              </span>
              In Your Codebase
            </h3>
            <div className="p-4 bg-foreground/[0.03] border-2 border-foreground/8 rounded-xl">
              <p className="text-sm text-foreground/70 font-medium leading-relaxed">
                {node.inYourCodebase}
              </p>
            </div>
          </section>
        )}

        {/* Key Takeaways */}
        {node.keyTakeaways.length > 0 && (
          <section>
            <h3 className="flex items-center gap-2 text-sm font-bold mb-3">
              <span className="w-6 h-6 rounded-md bg-accent-green/10 flex items-center justify-center">
                <BookOpen size={14} className="text-accent-green" />
              </span>
              Key Takeaways
            </h3>
            <ul className="space-y-2">
              {node.keyTakeaways.map((takeaway, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/80 font-medium leading-relaxed">
                  <span className="text-accent-green mt-1 shrink-0">•</span>
                  {takeaway}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Prerequisites */}
        {prereqNodes.length > 0 && (
          <section>
            <h3 className="text-sm font-bold mb-3">Prerequisites</h3>
            <div className="flex flex-wrap gap-2">
              {prereqNodes.map((prereq) => (
                <button
                  key={prereq.id}
                  onClick={() => onNavigateToNode(prereq.id)}
                  className={cn(
                    "cursor-pointer inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2",
                    "rounded-lg border-2 border-foreground/10 bg-surface",
                    "hover:border-primary/40 hover:text-primary hover:shadow-[2px_2px_0px_0px_#4F46E510] transition-all duration-200"
                  )}
                >
                  {prereq.status === "completed" && (
                    <CheckCircle2 size={12} className="text-accent-green" />
                  )}
                  {prereq.name}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Resources */}
        {node.resources.length > 0 && (
          <section>
            <h3 className="text-sm font-bold mb-3">Learning Resources</h3>
            <ResourceGroup resources={node.resources} />
          </section>
        )}

        {/* Action Button */}
        <div className="pt-5 border-t-2 border-foreground/8">
          {isCompleted ? (
            <Button
              variant="outline"
              className="w-full cursor-pointer h-11 text-sm"
              onClick={() => onMarkComplete(node.id)}
            >
              <CheckCircle2 size={16} className="mr-2" />
              Mark as Incomplete
            </Button>
          ) : (
            <Button
              className="w-full cursor-pointer h-11 text-sm"
              onClick={() => onMarkComplete(node.id)}
            >
              <CheckCircle2 size={16} className="mr-2" />
              Mark as Complete
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
