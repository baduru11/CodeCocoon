"use client";

import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { MermaidDiagram } from "./mermaid-diagram";
import type { TutorialData } from "@/types/tutorial";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TutorialOverviewProps {
  tutorial: TutorialData;
  onSelectChapter: (chapterIndex: number) => void;
}

function buildRelationshipDiagram(tutorial: TutorialData): string {
  const lines = ["flowchart TD"];

  // Add nodes
  for (let i = 0; i < tutorial.abstractions.length; i++) {
    const name = tutorial.abstractions[i].name.replace(/"/g, "'");
    lines.push(`    A${i}["${name}"]`);
  }

  // Add edges
  for (const rel of tutorial.relationships.details) {
    const label = rel.label.length > 30
      ? rel.label.slice(0, 27) + "..."
      : rel.label;
    lines.push(`    A${rel.from} -- "${label.replace(/"/g, "'")}" --> A${rel.to}`);
  }

  return lines.join("\n");
}

export function TutorialOverview({ tutorial, onSelectChapter }: TutorialOverviewProps) {
  const diagram = buildRelationshipDiagram(tutorial);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
          <BookOpen size={20} />
          Tutorial
        </h2>

        {/* Summary */}
        <div className="prose prose-sm max-w-none text-lg leading-relaxed font-medium">
          <Markdown remarkPlugins={[remarkGfm]}>
            {tutorial.relationships.summary}
          </Markdown>
        </div>
      </div>

      {/* Relationship Diagram */}
      <div className="border border-foreground/10 rounded-xl p-4 bg-surface/50 overflow-x-auto">
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
          How Concepts Connect
        </p>
        <MermaidDiagram chart={diagram} className="flex justify-center" />
      </div>

      {/* Chapter Index */}
      <div>
        <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
          Chapters
        </p>
        <div className="space-y-2">
          {tutorial.chapters.map((chapter, i) => {
            const abstraction = tutorial.abstractions[chapter.index];
            return (
              <Card
                key={chapter.filename}
                className="cursor-pointer hover:border-secondary/50 hover:bg-secondary/5 transition-all"
                onClick={() => onSelectChapter(i)}
              >
                <CardContent className="py-4 flex items-start gap-4">
                  <span className="shrink-0 w-8 h-8 flex items-center justify-center bg-secondary/10 text-secondary font-bold text-sm rounded-lg border border-secondary/20">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-bold text-sm">{chapter.name}</p>
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {abstraction?.description ?? ""}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
