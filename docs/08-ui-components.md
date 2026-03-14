# CodeCocoon — UI Components

All UI components in `components/ui/`. They use `cn()` from `@/lib/utils` and follow the neo-brutalist design system.

---

## Design System Foundation

### Colors (CSS variables in `globals.css`)
```css
--color-primary: #4F46E5        /* indigo — main CTAs */
--color-primary-hover: #4338CA
--color-secondary: #0D9488      /* teal — secondary actions */
--color-secondary-hover: #0F766E
--color-accent-yellow: #F59E0B  /* warnings, highlights */
--color-accent-green: #10B981   /* success */
--color-accent-purple: #8B5CF6  /* special */
--color-accent-orange: #F97316  /* danger/caution */
--color-accent-pink: #F43F5E    /* rare use */
--color-background: #F8FAFC
--color-surface: #FFFFFF
--color-foreground: #1E293B
--color-muted: #64748B
--color-border: #1E293B
```

### Neo-Brutalist Signature
Every interactive element has:
1. `border-2 border-foreground` (or `border-foreground/15` for cards)
2. `shadow-[3px_3px_0px_0px_#1E293B]` offset shadow
3. On hover: `translate-x-[2px] translate-y-[2px] shadow-none` (shift + remove shadow)

---

## `components/ui/button.tsx`

```typescript
"use client";
import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", disabled, loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-bold border-2 border-foreground transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "shadow-[3px_3px_0px_0px_#1E293B]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
          "disabled:opacity-50 disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0",
          "rounded-lg cursor-pointer",
          {
            "bg-primary text-white hover:bg-primary-hover": variant === "default",
            "bg-secondary text-white hover:bg-secondary-hover": variant === "secondary",
            "bg-surface text-foreground hover:bg-background": variant === "outline",
            "bg-transparent text-foreground border-transparent shadow-none hover:bg-foreground/5 hover:border-transparent hover:shadow-none hover:translate-x-0 hover:translate-y-0": variant === "ghost",
            "bg-red-500 text-white hover:bg-red-600": variant === "destructive",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-2.5 text-sm": size === "md",
            "px-7 py-3 text-base": size === "lg",
            "p-2.5 aspect-square": size === "icon",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 size={size === "sm" ? 14 : size === "lg" ? 20 : 16} className="animate-spin" />
            {children && <span className="ml-2">{children}</span>}
          </>
        ) : children}
      </button>
    );
  }
);
Button.displayName = "Button";
export { Button };
```

---

## `components/ui/card.tsx`

```typescript
import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("bg-surface border-2 border-foreground/15 rounded-xl shadow-sm", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-xl font-bold leading-tight tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted font-medium", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-6 pt-0", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
```

---

## `components/ui/badge.tsx`

```typescript
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-bold border rounded-md",
        {
          "bg-foreground/5 text-foreground border-foreground/20": variant === "default",
          "bg-primary/10 text-primary border-primary/30": variant === "primary",
          "bg-secondary/10 text-secondary border-secondary/30": variant === "secondary",
          "bg-accent-green/10 text-accent-green border-accent-green/30": variant === "success",
          "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30": variant === "warning",
          "bg-red-500/10 text-red-500 border-red-500/30": variant === "danger",
          "bg-transparent text-foreground border-foreground/20": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}
export { Badge };
```

---

## `components/ui/progress.tsx`

```typescript
interface ProgressProps {
  value: number;      // 0-100
  label?: string;
  color?: string;     // Tailwind bg-* class
  className?: string;
}

export function Progress({ value, label, color = "bg-primary", className }: ProgressProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex justify-between text-sm font-medium">
          <span>{label}</span>
          <span>{Math.round(value)}%</span>
        </div>
      )}
      <div className="h-3 bg-foreground/10 rounded-full border border-foreground/15 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color, "progress-stripes")}
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}
```

---

## `components/ui/input.tsx`

```typescript
import { cn } from "@/lib/utils";
import { forwardRef } from "react";

const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-lg border-2 border-foreground/20 bg-surface px-3 py-2",
        "text-sm font-medium placeholder:text-muted/60",
        "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
export { Input };
```

---

## `components/ui/skeleton.tsx`

```typescript
import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-foreground/8",
        className
      )}
      {...props}
    />
  );
}
```

---

## `components/ui/code-block.tsx`

```typescript
"use client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  className?: string;
  wrap?: boolean;
}

export function CodeBlock({ code, language = "typescript", showLineNumbers = false, className, wrap = false }: CodeBlockProps) {
  return (
    <div className={cn("code-block", wrap && "code-block-wrap", "rounded-xl overflow-hidden", className)}>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        customStyle={{ margin: 0, borderRadius: "inherit" }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
```

---

## `components/results/mermaid-diagram.tsx`

```typescript
"use client";
import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function sanitizeChart(raw: string): string {
  return raw
    .replace(/```mermaid\s*/gi, "")  // Strip markdown fences
    .replace(/```\s*$/gm, "")        // Strip closing fences
    .replace(/\t/g, "  ")            // Tabs to spaces
    .replace(/;\s*$/gm, "")          // Trailing semicolons (breaks Mermaid)
    .trim();
}

export function MermaidDiagram({ chart, className }: { chart: string; className?: string }) {
  const [svg, setSvg] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg: rendered } = await mermaid.render(id, sanitizeChart(chart));
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        console.warn("Mermaid render failed:", err);
        if (!cancelled) setError(true);
      }
    }
    render();
    return () => { cancelled = true; };
  }, [chart]);

  if (error) return <pre className="text-xs font-mono bg-surface p-4 border border-foreground/10 rounded-xl overflow-x-auto">{chart}</pre>;
  if (!svg) return <Skeleton className="h-48 w-full" />;
  return <div className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
```

**IMPORTANT**: Mermaid is dynamically imported (client-side only). The `securityLevel: "loose"` setting is needed for Mermaid to render. The sanitizer removes syntax that causes parse errors: fenced backticks, tabs, trailing semicolons.

---

## `components/results/section-tabs.tsx`

```typescript
export type TabId = "summary" | "learn" | "exercises";

interface SectionTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  exerciseProgress?: { completed: number; total: number };
}

const TABS = [
  { id: "summary" as TabId, label: "Tutorial", icon: BookOpen },
  { id: "learn" as TabId, label: "Learn", icon: GraduationCap },
  { id: "exercises" as TabId, label: "Exercises", icon: Dumbbell },
];

export function SectionTabs({ activeTab, onTabChange, exerciseProgress }: SectionTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-surface border-2 border-foreground/15 rounded-xl">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
            activeTab === tab.id
              ? "bg-foreground text-surface shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
              : "text-muted hover:text-foreground hover:bg-foreground/5"
          )}
        >
          <tab.icon size={16} />
          {tab.label}
          {tab.id === "exercises" && exerciseProgress && exerciseProgress.total > 0 && (
            <span className="ml-1 text-[10px] bg-accent-green/20 text-accent-green px-1.5 py-0.5 rounded-full font-bold">
              {exerciseProgress.completed}/{exerciseProgress.total}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
```

---

## `components/results/tutorial-chapter.tsx`

Renders a tutorial chapter's markdown content with Mermaid diagrams.

Key features:
- Uses `react-markdown` with `remark-gfm`
- Detects Mermaid code blocks and renders them with `<MermaidDiagram />`
- Cross-chapter navigation via `onNavigateToChapter(filename)` callback
- Prev/Next buttons for chapter navigation
- Code blocks use `<CodeBlock />` with syntax highlighting

---

## `components/results/skill-tree.tsx`

Visualizes the learning path V2 as a directed acyclic graph using **Dagre** for layout.

```typescript
// Uses dagre.graphlib.Graph for layout
// Renders with SVG: nodes as foreignObject elements, edges as SVG paths
// Node sizing: ~180x80px, ranked left-to-right ("LR")
// Highlights selected node + prerequisites
// Hover shows concept details
```

---

## `components/exercises/mcq-exercise.tsx`

```typescript
// Props: exercise, onAnswer(answer: string, isCorrect: boolean)
// Shows prompt + 4 option buttons (A/B/C/D)
// On submit: calls POST /api/exercises/evaluate
// Shows feedback with isCorrect state
// Color coding: green correct, red wrong, gray neutral
```

---

## `components/exercises/fill-blank-exercise.tsx`

```typescript
// For code_recreation exercises
// Parses ___BLANK_N___ placeholders in modifiedCode
// Renders code with input fields at blank positions
// Validates by comparing filled values to expectedAnswer JSON
```

---

## `components/exercises/parsons-exercise.tsx`

```typescript
// For parsons exercises
// Parses modifiedCode as JSON array of shuffled lines
// Drag-to-reorder interface (or up/down buttons)
// Submits ordered array as answer string
```

---

## `components/exercises/text-exercise.tsx`

```typescript
// For error_injection, code_explanation, error_message
// Shows originalCode and modifiedCode as context
// Free-text textarea for answer
// Submit → POST /api/exercises/evaluate → show feedback
```
