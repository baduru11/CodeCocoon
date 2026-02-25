"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface MermaidDiagramProps {
  chart: string;
  className?: string;
}

/** Sanitize common LLM mermaid syntax mistakes */
function sanitizeChart(raw: string): string {
  return raw
    .replace(/```mermaid\s*/gi, "")   // Strip markdown fences
    .replace(/```\s*$/gm, "")         // Strip closing fences
    .replace(/\t/g, "  ")             // Tabs to spaces
    .replace(/;\s*$/gm, "")           // Trailing semicolons
    .trim();
}

export function MermaidDiagram({ chart, className }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "neutral",
          securityLevel: "loose",
        });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const cleaned = sanitizeChart(chart);
        const { svg: rendered } = await mermaid.render(id, cleaned);
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        console.warn("Mermaid render failed:", err);
        if (!cancelled) setError(true);
      }
    }

    render();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <pre className="text-xs font-mono bg-surface p-4 border border-foreground/10 rounded-xl overflow-x-auto">
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
