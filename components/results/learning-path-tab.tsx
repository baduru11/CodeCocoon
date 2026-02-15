"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  BookOpen,
} from "lucide-react";
import type { LearningPath } from "@/types/learning";

interface LearningPathTabProps {
  learningPath: LearningPath | null | undefined;
}

export function LearningPathTab({ learningPath }: LearningPathTabProps) {
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
      return next;
    });
  };

  if (!learningPath?.modules || learningPath.modules.length === 0) {
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

          return (
            <Card key={mod.id} className="border-3 border-foreground/20 overflow-hidden">
              <button
                onClick={() => toggleModule(mod.id)}
                className="w-full text-left p-4 flex items-center justify-between hover:bg-surface/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white bg-foreground px-2 py-0.5 rounded-[4px]">
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
                          "p-3 rounded-[4px] border-2 border-foreground/10",
                          "hover:border-foreground/20 transition-colors"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen size={14} className="text-secondary shrink-0" />
                          <p className="text-sm font-bold">{lesson.title}</p>
                        </div>
                        <p className="text-xs text-muted font-medium ml-[22px]">
                          {lesson.description}
                        </p>
                        {lesson.keyConceptsFromCode && (
                          <p className="text-xs text-secondary/80 font-medium ml-[22px] mt-1 italic">
                            From your code: {lesson.keyConceptsFromCode}
                          </p>
                        )}
                        {lesson.resources.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2 ml-[22px]">
                            {lesson.resources.map((res, ri) => (
                              <a
                                key={ri}
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "inline-flex items-center gap-1 text-xs font-bold px-2 py-1",
                                  "rounded-[4px] border-2 border-foreground/15",
                                  "text-secondary hover:bg-secondary/10 hover:border-secondary/30 transition-colors"
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
