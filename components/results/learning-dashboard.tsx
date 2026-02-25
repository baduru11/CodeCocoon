"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "./progress-ring";
import { Clock, Target, CheckCircle2, GraduationCap, Layers } from "lucide-react";
import type { LearningPathV2, SkillModule, SkillNode } from "@/types/learning";

interface LearningDashboardProps {
  learningPath: LearningPathV2;
  onModuleClick?: (moduleId: string) => void;
}

export function LearningDashboard({ learningPath, onModuleClick }: LearningDashboardProps) {
  const { role, gapAnalysis, modules, nodes, totalConcepts, completedConcepts, estimatedTotalMinutes } = learningPath;

  const completedMinutes = nodes
    .filter((n) => n.status === "completed")
    .reduce((sum, n) => sum + n.estimatedMinutes, 0);
  const remainingMinutes = estimatedTotalMinutes - completedMinutes;
  const progressPercent = totalConcepts > 0 ? (completedConcepts / totalConcepts) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Progress Header Card */}
      <Card className="p-6 border-2 border-foreground/15 bg-surface">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Left: Role + Level */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <GraduationCap size={20} className="text-primary shrink-0" />
              <h2 className="text-lg font-bold truncate">Your Learning Path</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary" className="text-xs px-3 py-1">
                {role.displayName}
              </Badge>
              <Badge variant="warning" className="capitalize text-xs px-3 py-1">
                {learningPath.skillLevel}
              </Badge>
            </div>
          </div>

          {/* Right: Progress */}
          <div className="flex items-center gap-4 sm:ml-auto">
            <ProgressRing progress={progressPercent} size={52} strokeWidth={4}>
              <span className="text-xs font-bold">{Math.round(progressPercent)}%</span>
            </ProgressRing>
            <div>
              <p className="text-sm font-bold">
                {completedConcepts}/{totalConcepts} concepts
              </p>
              <p className="text-xs text-muted font-medium flex items-center gap-1 mt-0.5">
                <Clock size={12} />
                {remainingMinutes > 0 ? `~${Math.round(remainingMinutes / 60 * 10) / 10}h remaining` : "Complete!"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Gap Analysis Banner */}
      {gapAnalysis.summary && (
        <Card className="p-6 bg-gradient-to-r from-primary/[0.04] to-accent-purple/[0.04] border-2 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target size={20} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-bold mb-1.5">Personalized for You</p>
              <p className="text-sm text-foreground/70 font-medium leading-relaxed mb-4">
                {gapAnalysis.summary}
              </p>

              {gapAnalysis.likelyKnown.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs font-bold text-muted uppercase tracking-wide">
                    You likely know:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {gapAnalysis.likelyKnown.map((item) => (
                      <span
                        key={item}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/20"
                      >
                        <CheckCircle2 size={10} className="inline mr-1" />
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {gapAnalysis.focusAreas.length > 0 && (
                <div>
                  <span className="text-xs font-bold text-muted uppercase tracking-wide">
                    Focus areas:
                  </span>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {gapAnalysis.focusAreas.map((item) => (
                      <span
                        key={item}
                        className="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Module Cards Section */}
      <div>
        <h3 className="flex items-center gap-2 text-sm font-bold text-muted uppercase tracking-wide mb-4">
          <Layers size={16} />
          Modules
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => (
            <ModuleCard
              key={mod.id}
              module={mod}
              nodes={nodes.filter((n) => mod.nodeIds.includes(n.id))}
              onClick={() => onModuleClick?.(mod.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Module Card ────────────────────────────────────────────────────

interface ModuleCardProps {
  module: SkillModule;
  nodes: SkillNode[];
  onClick?: () => void;
}

function ModuleCard({ module, nodes, onClick }: ModuleCardProps) {
  const completed = nodes.filter((n) => n.status === "completed").length;
  const total = nodes.length;
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const totalMinutes = nodes.reduce((sum, n) => sum + n.estimatedMinutes, 0);

  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer text-left w-full p-5 rounded-xl border-2 border-foreground/10 bg-surface",
        "hover:border-foreground/25 hover:shadow-[3px_3px_0px_0px_#1E293B] transition-all duration-200"
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <ProgressRing
          progress={percent}
          size={44}
          strokeWidth={3.5}
          strokeColor={module.color}
        >
          <span className="text-[10px] font-bold">
            {completed}/{total}
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug">{module.title}</p>
          <p className="text-xs text-muted font-medium mt-1">
            {total} concepts · ~{totalMinutes} min
          </p>
        </div>
      </div>
      {module.description && (
        <p className="text-xs text-foreground/60 font-medium leading-relaxed mb-3 line-clamp-2">
          {module.description}
        </p>
      )}
      {/* Color bar */}
      <div className="h-1.5 rounded-full bg-foreground/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: module.color }}
        />
      </div>
    </button>
  );
}
