# CodeCocoon — Feature Components

All non-UI components organized by section.

---

## Layout Components

### `components/layout/navbar.tsx`

```typescript
"use client";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthButton } from "./auth-button";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/connect", label: "Connect" },
    { href: "/history", label: "History" },
    ...(isAuthenticated ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b-2 border-foreground/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo with neo-brutalist hover */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="p-1.5 bg-accent-yellow border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B] group-hover:shadow-none group-hover:translate-x-[1px] group-hover:translate-y-[1px] transition-all">
              <Code2 size={18} strokeWidth={3} />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:block">CodeCocoon</span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}
                className={cn("px-3.5 py-2 font-bold text-sm rounded-lg transition-colors cursor-pointer",
                  isActive(link.href)
                    ? "bg-foreground text-surface"
                    : "text-muted hover:text-foreground hover:bg-foreground/5"
                )}>
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth + Mobile Toggle */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block"><AuthButton /></div>
            <button onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 border-2 border-foreground/20 rounded-lg hover:bg-foreground/5 cursor-pointer">
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu — max-height transition */}
      <div className={cn("md:hidden overflow-hidden transition-all duration-300 border-t border-foreground/10 bg-surface/95 backdrop-blur-xl",
        mobileOpen ? "max-h-96" : "max-h-0 border-t-0")}>
        <div className="px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className={cn("block px-4 py-2.5 font-bold text-sm rounded-lg transition-colors cursor-pointer",
                isActive(link.href) ? "bg-foreground text-surface" : "text-muted hover:text-foreground hover:bg-foreground/5"
              )}>
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-foreground/10"><AuthButton /></div>
        </div>
      </div>
    </nav>
  );
}
```

---

### `components/layout/auth-button.tsx`

```typescript
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Github, LayoutDashboard, LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/connect`,
        scopes: "public_repo read:user",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) return <div className="h-9 w-40 bg-foreground/5 rounded-lg animate-pulse" />;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all bg-surface cursor-pointer">
          <LayoutDashboard size={14} /> Dashboard
        </Link>
        <button onClick={handleLogout}
          className="p-1.5 border border-foreground/20 rounded-lg hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors cursor-pointer"
          title="Sign out">
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleLogin}
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-foreground text-surface border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all cursor-pointer">
      <Github size={16} /> Login with GitHub
    </button>
  );
}
```

---

### `components/layout/footer.tsx`

```typescript
import Link from "next/link";
import { Github, Heart, Code2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-surface border-t-2 border-foreground/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-accent-yellow border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B]">
              <Code2 size={16} strokeWidth={3} />
            </div>
            <span className="font-bold text-lg">CodeCocoon</span>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            <Link href="/" className="text-sm font-bold text-muted hover:text-foreground transition-colors">Home</Link>
            <Link href="/connect" className="text-sm font-bold text-muted hover:text-foreground transition-colors">Connect</Link>
            <Link href="/history" className="text-sm font-bold text-muted hover:text-foreground transition-colors">History</Link>
          </nav>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-foreground/10">
          <p className="font-medium text-sm text-muted flex items-center gap-1.5">
            Built with <Heart size={14} className="text-accent-pink fill-accent-pink" /> for vibe coders ready to spread their wings
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-medium">&copy; {new Date().getFullYear()} CodeCocoon</span>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer"
              className="p-2 border-2 border-foreground/20 rounded-lg hover:border-foreground/40 hover:bg-foreground/5 transition-all cursor-pointer">
              <Github size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
```

---

## Landing Components

### `components/landing/hero.tsx`
Key elements:
- Dot grid background + gradient overlay
- Staggered `animate-fade-in` with `--delay` CSS var
- Yellow highlighted word effect: `position: relative` + `<span>` with yellow background `h-5 -z-0 -rotate-1`
- Terminal mockup: dark bg `bg-foreground`, colored terminal text, blinking cursor `animate-blink`
- CTA: "Connect GitHub" (primary) + "Paste Repo URL" (outline)

### `components/landing/how-it-works.tsx`
3-step section: numbered cards (1, 2, 3) with icon + title + description. Desktop horizontal line connector via `absolute top-16 left-[20%] right-[20%] h-[2px]`.

### `components/landing/features.tsx`
6-feature grid. Each card has: left border accent (`border-l-[5px]` colored), icon with colored bg, title, description. Colors cycle through primary/secondary/accent-yellow/accent-green/accent-purple/accent-orange.

---

## Results Components

### `components/results/tutorial-overview.tsx`

Displays chapter cards grid. Each card shows chapter title, abstract name, and a "Read Chapter" button. Clicking calls `onChapterSelect(index)` to load `TutorialChapter`.

Props:
```typescript
interface TutorialOverviewProps {
  tutorialData: TutorialData;
  onChapterSelect: (index: number) => void;
}
```

### `components/results/tutorial-chapter.tsx`

Full markdown renderer for a tutorial chapter. Uses `react-markdown` + `remark-gfm`.

Custom renderers:
- `code` with `language-mermaid` → `<MermaidDiagram />`
- `code` with other lang → `<pre>` with `font-mono`
- `code` without lang → inline `<code>` with border
- `a` without `http`/`#` prefix → cross-chapter link button (calls `onNavigateToChapter(filename)`)
- `h1`–`h3` → styled with `font-bold`
- `p`, `ul`, `ol`, `li`, `blockquote` → styled with consistent spacing

Bottom navigation: Prev / Overview / Next buttons.

### `components/results/section-tabs.tsx`

```typescript
export type TabId = "summary" | "learn" | "exercises";
// 3 tabs: Tutorial (BookOpen), Learn (GraduationCap), Exercises (Dumbbell)
// Active tab: bg-foreground text-surface shadow
// Exercises tab shows progress: "2/8" in accent-green pill
```

### `components/results/learning-path-tab.tsx`

Dispatches between V1 and V2 views:
- `isV2LearningPath(path)` → `<V2LearningPathView>`
- otherwise → `<V1LearningPathView>`

**V2 View**:
- `<LearningDashboard>` — role, progress, gap analysis, module grid
- Desktop: `<SkillTree>` — interactive dagre graph
- Mobile: `<LinearPathView>` — list-based fallback
- `<ConceptDetailInline>` — shown below tree when node selected

**V1 View**:
- Accordion list of modules (expand/collapse)
- Per-module: techStack badge, lesson count, lesson list with resources

### `components/results/skill-tree.tsx`

SVG-based directed graph using **Dagre** for layout.

```typescript
// Layout config:
const g = new dagre.graphlib.Graph();
g.setGraph({ rankdir: "LR", nodesep: 20, ranksep: 60 });
// Node size: 180x80
// Edges: SVG path with bezier curves
// Nodes: foreignObject with React content inside

// Node colors from module.color (8 predefined hex colors)
// Selected node highlighted with ring
// Prerequisites highlighted on hover
```

### `components/results/learning-dashboard.tsx`

Shows V2 learning path summary:
- Role badge (from `learningPath.role`)
- Progress: `completedConcepts / nodes.length` with ring chart
- Gap analysis callout (if `gapAnalysis.hasGap`)
- Module grid: each module as colored card with progress

### `components/results/concept-detail-panel.tsx`

`<ConceptDetailInline>` — shows full lesson content when a skill tree node is clicked.

Props:
```typescript
interface ConceptDetailInlineProps {
  node: SkillNode;
  onClose: () => void;
  onMarkComplete: (nodeId: string) => void;
  onNavigateToNode: (nodeId: string) => void;
  allNodes: SkillNode[];
}
```

Displays:
- Module badge (colored)
- Concept title + explanation
- "In Your Codebase" section
- Key Takeaways list
- Prerequisites (clickable, navigate to that node)
- Resources list with `<ResourceCard>`
- "Mark Complete" toggle button

### `components/results/resource-card.tsx`

```typescript
interface ResourceCardProps {
  resource: PlatformRecommendation;
}
// Shows: platform logo icon, title, type badge, price badge, difficulty, duration
// External link opens in new tab
// Price tiers: free (green), paid (yellow), freemium (blue)
```

### `components/results/progress-ring.tsx`

SVG circular progress indicator.
```typescript
// Props: value (0-100), size, strokeWidth, color
// Uses SVG circle with stroke-dasharray/stroke-dashoffset
```

### `components/results/linear-path-view.tsx`

Mobile fallback for skill tree. Lists nodes in dependency order with:
- Status indicator (ready/completed)
- Module color stripe on left
- "Mark Complete" toggle
- Click to open concept detail

### `components/results/exercises-tab.tsx`

Full exercises interface embedded in results page.

**State**:
- `currentEx`: current exercise index
- `completed: Set<string>`: IDs of correctly answered exercises
- `attempted: Set<string>`: IDs of attempted exercises
- `activeFilter`: exercise type filter
- `showScore`: boolean to show score screen

**Exercise Component Routing**:
```typescript
switch (ex.type) {
  case "mcq":
  case "output_prediction": return <MCQExercise />;
  case "code_recreation":   return <FillBlankExercise />;
  case "parsons":           return <ParsonsExercise />;
  case "error_message":     return <ErrorMessageExercise />;
  default:                  return <TextExercise />;  // error_injection, code_explanation
}
```

All exercises mounted simultaneously; only current one visible (`display: none` for others).

**Score Screen**: Trophy icon, percentage, per-type breakdown bars, Generate More / Regenerate buttons.

---

## Exercise Components

### `components/exercises/mcq-exercise.tsx`

Multiple-choice question interface.

**correctOptionIndex Resolution** (3-step fallback):
1. Text match: `options.findIndex(opt => opt === expectedAnswer)`
2. Numeric: `correctOptionIndex` field (0-based)
3. Letter match: `expectedAnswer === "A"` → index 0

**Option States**: idle → selected → submitted (correct/wrong). Color coding: selected=secondary, correct=accent-green, wrong=primary.

"Show Answer" button reveals correct option before submission (marks exercise as not-correct). "Check Answer" is disabled if no options or no correct answer resolved.

### `components/exercises/fill-blank-exercise.tsx`

For `code_recreation` exercises. Parses `___BLANK_N___` placeholders in `modifiedCode`.

```typescript
// Parses modified_code into segments:
// { type: "code" | "blank", content: string, blankIndex?: number }[]
// Renders code segments interleaved with <input> fields
// Uses CodeMirror (@uiw/react-codemirror) for code display
// Validation: compare filled values to expectedAnswer JSON parsed array
```

### `components/exercises/parsons-exercise.tsx`

For `parsons` exercises. Parses `modifiedCode` as JSON array of shuffled lines.

```typescript
// Renders draggable/reorderable list of code lines
// Up/Down arrow buttons for accessibility
// Submit: joins ordered lines, compares to expectedAnswer
```

### `components/exercises/text-exercise.tsx`

For `error_injection`, `code_explanation`, `error_message` exercises.

```typescript
// Shows: originalCode (if present) + modifiedCode as context
// Textarea for free-text answer
// Submit → POST /api/exercises/evaluate
// Response: { isCorrect: boolean, feedback: string }
// Shows feedback with green (correct) or red (wrong) styling
```

### `components/exercises/error-message-exercise.tsx`

Specialized for `error_message` type.

```typescript
// Shows code with injected error
// User types the expected error message
// Submit → POST /api/exercises/evaluate
// Specific styling for error context display
```

---

## Additional UI Components

### `components/ui/textarea.tsx`

```typescript
const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref}
      className={cn(
        "flex min-h-[100px] w-full rounded-lg border-2 border-foreground/20 bg-surface px-3 py-2",
        "text-sm font-medium placeholder:text-muted/60 resize-y",
        "focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
);
```

### `components/ui/select.tsx`

```typescript
// Custom select wrapper with styled dropdown
// Props: value, onChange, options: { value, label }[]
// Uses native <select> with custom styling overlay
// border-2 border-foreground/20 rounded-lg appearance-none
// ChevronDown icon positioned absolute right
```

### `components/ui/dialog.tsx`

```typescript
// Modal dialog with backdrop
// Props: open, onClose, title, children
// Backdrop: fixed inset-0 bg-foreground/20 backdrop-blur-sm
// Dialog: bg-surface border-2 border-foreground rounded-xl shadow-[6px_6px_0px_0px_#1E293B]
// Closes on backdrop click or X button
```

### `components/ui/tabs.tsx`

```typescript
// Simple tab container
// Props: tabs: { id, label }[], activeTab, onTabChange
// Same styling as SectionTabs but generic
```
