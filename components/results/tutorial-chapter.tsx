"use client";

import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MermaidDiagram } from "./mermaid-diagram";
import type { TutorialChapter as TutorialChapterType } from "@/types/tutorial";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface TutorialChapterProps {
  chapter: TutorialChapterType;
  chapterNum: number;
  totalChapters: number;
  onBack: () => void;
  onPrev: () => void;
  onNext: () => void;
  onNavigateToChapter: (filename: string) => void;
}

export function TutorialChapter({
  chapter,
  chapterNum,
  totalChapters,
  onBack,
  onPrev,
  onNext,
  onNavigateToChapter,
}: TutorialChapterProps) {
  const components: Components = {
    // Render mermaid code blocks as diagrams
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const lang = match?.[1];
      const content = String(children).replace(/\n$/, "");

      if (lang === "mermaid") {
        return (
          <div className="my-4 border border-foreground/10 rounded-xl p-4 bg-surface/50 overflow-x-auto">
            <MermaidDiagram chart={content} className="flex justify-center" />
          </div>
        );
      }

      // Regular code blocks
      if (lang) {
        return (
          <pre className="text-sm font-mono bg-surface p-4 border border-foreground/10 rounded-xl overflow-x-auto my-4">
            <code className={className} {...props}>
              {content}
            </code>
          </pre>
        );
      }

      // Inline code
      return (
        <code
          className="text-sm font-mono bg-surface px-1.5 py-0.5 border border-foreground/10 rounded-md"
          {...props}
        >
          {children}
        </code>
      );
    },
    // Intercept links to other chapters
    a({ href, children, ...props }) {
      if (href && !href.startsWith("http") && !href.startsWith("#")) {
        // Likely a cross-chapter link like "01_query_processing"
        const filename = href.replace(/\.md$/, "");
        return (
          <button
            type="button"
            onClick={() => onNavigateToChapter(filename)}
            className="text-secondary font-bold underline underline-offset-2 cursor-pointer hover:text-secondary/80"
          >
            {children}
          </button>
        );
      }
      return (
        <a href={href} className="text-secondary font-bold underline underline-offset-2" {...props}>
          {children}
        </a>
      );
    },
    h1({ children }) {
      return <h1 className="text-2xl font-bold mt-8 mb-4">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-xl font-bold mt-6 mb-3">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-lg font-bold mt-5 mb-2">{children}</h3>;
    },
    p({ children }) {
      return <p className="text-base leading-relaxed font-medium mb-4">{children}</p>;
    },
    ul({ children }) {
      return <ul className="list-disc pl-6 space-y-1 mb-4">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-6 space-y-1 mb-4">{children}</ol>;
    },
    li({ children }) {
      return <li className="text-base leading-relaxed font-medium">{children}</li>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-secondary/40 pl-4 italic text-muted my-4">
          {children}
        </blockquote>
      );
    },
    pre({ children }) {
      // Pre tags are handled by the code component above for syntax-highlighted blocks
      return <>{children}</>;
    },
  };

  return (
    <div>
      {/* Top Nav */}
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="gap-1.5 cursor-pointer"
        >
          <ArrowLeft size={14} />
          Overview
        </Button>
        <span className="text-xs font-bold text-muted">
          Chapter {chapterNum} of {totalChapters}
        </span>
      </div>

      {/* Chapter Content */}
      <article className="max-w-none">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {chapter.content}
        </Markdown>
      </article>

      {/* Bottom Nav */}
      <div className="flex items-center justify-between mt-10 pt-6 border-t border-foreground/10">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={chapterNum <= 1}
          className="gap-1.5 cursor-pointer"
        >
          <ChevronLeft size={14} />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="cursor-pointer"
        >
          Overview
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={chapterNum >= totalChapters}
          className="gap-1.5 cursor-pointer"
        >
          Next
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}
