# Design: Learning Path Redesign — Role-Based Skill Tree with Partnership-Ready Resources

> **Date:** 2026-02-24
> **Status:** Draft
> **Scope:** Replace the single-call learning path with a 4-step AI pipeline producing role-aware, dependency-mapped skill graphs — rendered as an interactive skill tree with premium resource recommendations designed to connect users to edu-tech platforms.

---

## Table of Contents

1. [Overview](#1-overview)
2. [New Types](#2-new-types)
3. [AI Pipeline (4 Steps)](#3-ai-pipeline-4-steps)
4. [Pipeline Integration & SSE Events](#4-pipeline-integration--sse-events)
5. [Rate Limiting & Resilience](#5-rate-limiting--resilience)
6. [UI — Skill Tree (Hero Visual)](#6-ui--skill-tree-hero-visual)
7. [UI — Module Dashboard & Progress](#7-ui--module-dashboard--progress)
8. [UI — Resource Cards (Partnership Surface)](#8-ui--resource-cards-partnership-surface)
9. [Configure Page Changes](#9-configure-page-changes)
10. [Data Storage](#10-data-storage)
11. [New Dependencies](#11-new-dependencies)
12. [Implementation Phases](#12-implementation-phases)

---

## 1. Overview

### The Problem

The current learning path is a single LLM call producing flat modules with generic lessons and often-hallucinated resource links. The UI is a basic accordion. It doesn't feel like a product an edu-tech company would want to partner with.

### The Vision

CodeCocoon is a **diagnosis + recommendation engine**, not a classroom. The learning path should:

- **Diagnose precisely** — Analyze the user's codebase, role, and skill level to identify exactly what they need to learn and why
- **Explain substantively** — Give enough context per concept that users understand what it is and why it matters (100-200 words, code references, analogies) — but strategically stop short of being a full course
- **Recommend credibly** — Connect users to the best external learning platforms with curated, transparent recommendations
- **Look partnership-worthy** — The UI should be polished enough that edu-tech companies see it and think "we want our courses featured there"

### Business Model

```
User analyzes codebase → Gets personalized skill diagnosis →
Understands what they need to learn → Clicks through to partner platform →
Partner platform gains a high-intent, pre-qualified learner →
Partner sponsors/pays CodeCocoon for the referral
```

### Key Decisions

| Decision | Choice |
|----------|--------|
| Content depth | Substantive diagnosis, not full courses — "doctor, not surgeon" |
| Personalization axis | Role-based (same codebase, different paths per role) |
| Visual centerpiece | Interactive skill tree (node graph with dependencies) |
| Overview layer | Module dashboard with progress rings |
| Resource presentation | Premium cards with platform branding, price transparency, CTAs |
| Tutorial integration | Deeply integrated when available, standalone fallback when not |
| Pipeline depth | 4-step sequential (concept extraction → dependency graph → lesson content → resource curation) |

### What Changes

- `types/learning.ts` — New types: `RoleProfile`, `SkillNode`, `SkillEdge`, `PlatformRecommendation`, `LearningPathV2`
- `lib/ai/prompts.ts` — 4 new prompt functions replacing `generateLearningPath` and `generateLearningPathWithContext`
- `app/api/process/route.ts` — Learning path pipeline replaces single LLM call
- `hooks/use-processing.ts` — New SSE event handlers for 4 pipeline steps
- `lib/constants.ts` — New processing steps
- `components/results/learning-path-tab.tsx` — Complete rewrite: skill tree + dashboard + resource cards
- `app/(main)/configure/page.tsx` — Role selection UI added

### What Stays the Same

- Tutorial pipeline — unchanged
- Exercises — unchanged
- All other pages — unchanged
- `app/api/learn/generate/route.ts` — Kept for standalone API usage, updated to use new pipeline

---

## 2. New Types

### `types/learning.ts` (complete rewrite)

```typescript
// --- Role ---

export interface RoleProfile {
  preset: RolePreset | null;     // Selected preset, null if custom
  custom: string | null;         // Freeform description, null if preset
  displayName: string;           // Resolved display name for UI
}

export type RolePreset =
  | "frontend_dev"
  | "backend_dev"
  | "fullstack_dev"
  | "devops_infra"
  | "product_manager"
  | "qa_testing";

export const ROLE_PRESETS: Record<RolePreset, { label: string; description: string; icon: string }> = {
  frontend_dev: {
    label: "Frontend Developer",
    description: "New to the frontend codebase — components, styling, state management",
    icon: "Monitor",
  },
  backend_dev: {
    label: "Backend Developer",
    description: "Focused on APIs, database, server logic, and infrastructure",
    icon: "Server",
  },
  fullstack_dev: {
    label: "Full-Stack Developer",
    description: "Need to understand the full picture — frontend to backend",
    icon: "Layers",
  },
  devops_infra: {
    label: "DevOps / Infrastructure",
    description: "Focused on deployment, CI/CD, configs, and infrastructure code",
    icon: "Container",
  },
  product_manager: {
    label: "Product Manager",
    description: "Want to understand the architecture and tech decisions, not write code",
    icon: "BarChart3",
  },
  qa_testing: {
    label: "QA / Testing",
    description: "Focused on test coverage, testing patterns, and quality assurance",
    icon: "ShieldCheck",
  },
};

// --- Skill Graph ---

export type ConceptCategory =
  | "language"
  | "framework"
  | "pattern"
  | "tooling"
  | "architecture"
  | "library";

export interface SkillNode {
  id: string;                          // Unique identifier (e.g., "react-hooks")
  name: string;                        // Display name (e.g., "React Hooks")
  category: ConceptCategory;
  moduleId: string;                    // Which module group this belongs to
  relevanceScore: number;              // 0-1, how relevant to the user's role
  difficulty: number;                  // 1-5
  estimatedMinutes: number;            // Estimated learning time
  prerequisites: string[];             // IDs of prerequisite SkillNodes

  // Lesson content (substantive but not exhaustive)
  explanation: string;                 // 100-200 words: what it is, why it matters, analogy
  inYourCodebase: string;              // 2-3 sentences: specific files/patterns where this appears
  keyTakeaways: string[];              // 2-3 bullet points
  tags: string[];                      // For resource matching (e.g., ["react-hooks", "state"])

  // Resources
  resources: PlatformRecommendation[];

  // Progress (client-side)
  status: "locked" | "ready" | "in_progress" | "completed";
}

export interface SkillEdge {
  from: string;    // SkillNode ID (prerequisite)
  to: string;      // SkillNode ID (depends on `from`)
}

// --- Modules (grouping layer) ---

export interface SkillModule {
  id: string;
  title: string;                 // e.g., "React Fundamentals"
  description: string;
  category: ConceptCategory;     // Primary category
  nodeIds: string[];             // SkillNode IDs in this module
  color: string;                 // Accent color for visual grouping
}

// --- Resources (partnership surface) ---

export type ResourceType = "course" | "video" | "article" | "interactive" | "documentation";
export type PriceTier = "free" | "paid" | "subscription";
export type ResourceIntent = "start_here" | "go_deeper" | "quick_reference";

export interface PlatformRecommendation {
  platform: string;              // e.g., "Coursera", "freeCodeCamp", "MDN"
  title: string;                 // Course/article title
  url: string;
  type: ResourceType;
  intent: ResourceIntent;
  priceTier: PriceTier;
  difficulty: string;            // "beginner", "intermediate", "advanced"
  estimatedDuration: string;     // e.g., "2 hours", "4 weeks"
  whyThisResource: string;       // One-line contextual recommendation
}

// --- Gap Analysis ---

export interface GapAnalysis {
  likelyKnown: string[];         // Concepts the user probably already knows
  focusAreas: string[];          // Concepts the user should prioritize
  summary: string;               // 2-3 sentence personalized summary
}

// --- Top-level container ---

export interface LearningPathV2 {
  id: string;
  projectId: string;
  role: RoleProfile;
  skillLevel: string;
  gapAnalysis: GapAnalysis;
  modules: SkillModule[];
  nodes: SkillNode[];
  edges: SkillEdge[];
  totalConcepts: number;
  completedConcepts: number;
  estimatedTotalMinutes: number;
}

// --- Backward compat ---
// Keep the old LearningPath type as LearningPathV1 for old sessions

export interface LearningPathV1 {
  id: string;
  projectId: string;
  title: string;
  description: string;
  skillLevel: string;
  modules: LearningPathV1Module[];
  totalLessons: number;
  completedLessons: number;
}

export interface LearningPathV1Module {
  id: string;
  title: string;
  description: string;
  techStack: string;
  lessons: LearningPathV1Lesson[];
}

export interface LearningPathV1Lesson {
  id: string;
  title: string;
  description: string;
  keyConceptsFromCode: string;
  resources: { title: string; url: string; type: string; source: string }[];
  completed?: boolean;
}

/** Union type — check for `role` field to distinguish versions */
export type LearningPath = LearningPathV1 | LearningPathV2;

export function isV2LearningPath(lp: LearningPath): lp is LearningPathV2 {
  return "role" in lp && "nodes" in lp;
}
```

### Changes to `types/analysis.ts` — AnalysisStreamEvent

```typescript
export interface AnalysisStreamEvent {
  type:
    | "status" | "tech_stack" | "architecture" | "key_files"
    | "tutorial_abstractions" | "tutorial_relationships"
    | "tutorial_order" | "tutorial_chapter"
    | "summary"
    // New learning path events
    | "learning_concepts" | "learning_graph"
    | "learning_lessons" | "learning_resources"
    | "learning_path"
    | "exercises"
    | "complete" | "error";
  data: unknown;
}
```

---

## 3. AI Pipeline (4 Steps)

### Step 1: Role-Based Concept Extraction (`gemini-2.0-flash`)

**Input:**
- Role profile (preset label + description, or custom text)
- Skill level (beginner / intermediate / advanced)
- Tech stack array from analysis
- Tutorial abstractions + relationships (integrated mode) OR raw code samples (standalone mode)

**Output:** A list of 10-20 concepts, each with:
- `name`, `category` (framework / pattern / language / tooling / architecture / library)
- `relevanceScore` (0-1) for this role
- `fileReferences` — indices into the codebase files where this concept appears
- `moduleGroup` — a suggested grouping label (e.g., "React Fundamentals")

**Prompt strategy:**
- In integrated mode, the prompt receives the tutorial abstractions list and relationship summary. It maps role needs against existing abstractions, identifying which abstractions matter for this role and extracting finer-grained concepts from them.
- In standalone mode, receives tech stack + truncated code samples (same as current approach, but with role context added).

**Model:** `gemini-2.0-flash`

### Step 2: Dependency Graph & Skill Gap Analysis (`gemini-2.0-flash`)

**Input:**
- Concept list from Step 1
- User's skill level
- Codebase patterns summary (from analysis context)

**Output:**
- `prerequisites`: For each concept, a list of other concept IDs it depends on
- `difficulty`: 1-5 rating per concept
- `estimatedMinutes`: Learning time per concept
- `gapAnalysis`:
  - `likelyKnown`: Concepts the user probably already knows based on skill level
  - `focusAreas`: Concepts that should be prioritized
  - `summary`: 2-3 sentence personalized gap analysis

**Prompt strategy:** The prompt describes each concept and asks the LLM to reason about prerequisite ordering (e.g., "you need to understand JSX before component composition") and estimate difficulty relative to the stated skill level. The gap analysis considers what someone at that skill level typically already knows.

**Model:** `gemini-2.0-flash`

### Step 3: Lesson Content Generation (`gemini-2.5-flash`)

**Input:** All concepts with their file references and codebase context. Generated in a **single call** (not per-concept) to minimize API requests.

**Output per concept:**
- `explanation` (100-200 words): What it is, why it matters, a simple analogy. Substantive enough to understand at a surface level, but not a full tutorial.
- `inYourCodebase` (2-3 sentences): Specific files and patterns where this concept appears. References actual file paths from the codebase.
- `keyTakeaways` (2-3 bullet points): The most important things to remember.
- `tags` (string array): For resource matching in Step 4 (e.g., `["react-hooks", "useState", "state-management"]`).

**Model:** `gemini-2.5-flash` — richer content generation needs the deeper model.

**Why single call:** Each lesson is 100-200 words (not full chapters). 15 concepts × ~200 words = ~3000 words output. Well within a single call's token budget with `maxTokens: 16384`.

### Step 4: Resource Curation (`gemini-2.0-flash`)

**Input:** All concepts with their tags, the user's skill level, concept difficulty ratings.

**Output per concept:** 3-5 curated resources, each with:
- `platform`: Platform name (e.g., "Coursera", "MDN", "freeCodeCamp", "Udemy", "Frontend Masters")
- `title`: Specific course/article title
- `url`: URL to the resource
- `type`: course / video / article / interactive / documentation
- `intent`: "start_here" (free, beginner-friendly), "go_deeper" (paid, comprehensive), "quick_reference" (docs, cheat sheets)
- `priceTier`: free / paid / subscription
- `difficulty`: beginner / intermediate / advanced
- `estimatedDuration`: Human-readable (e.g., "2 hours", "4 weeks")
- `whyThisResource`: One-line contextual explanation

**Model:** `gemini-2.0-flash`

**Single call** for all concepts. Structured JSON output.

**URL hallucination mitigation:** The prompt instructs the model to only recommend resources from well-known platforms with predictable URL patterns (e.g., `https://developer.mozilla.org/en-US/docs/...`, `https://react.dev/learn/...`). Future phase: validate URLs with HEAD requests.

---

## 4. Pipeline Integration & SSE Events

### Processing flow

```
files → [techStack, architecture, keyFiles] + [tutorialPipeline]
      → [learningPathPipeline (4 steps)] + [exercises]
```

The learning path pipeline starts **after** the tutorial completes so it can use abstractions/relationships as input (integrated mode). Exercises run **in parallel** with the learning path since they're independent.

### New SSE events

| Event | Payload | When |
|---|---|---|
| `learning_concepts` | Concept list (names, categories, relevance scores) | After Step 1 |
| `learning_graph` | Edges, difficulty, time estimates, gap analysis | After Step 2 |
| `learning_lessons` | Lesson content for all concepts | After Step 3 |
| `learning_resources` | Resource recommendations for all concepts | After Step 4 |
| `learning_path` | Full assembled `LearningPathV2` | Final assembled result |

### Updated `PROCESSING_STEPS` in `lib/constants.ts`

```typescript
export const PROCESSING_STEPS = [
  { key: "files_fetched", label: "Fetching file contents" },
  { key: "tech_stack", label: "Detecting tech stack" },
  { key: "architecture", label: "Analyzing architecture" },
  { key: "key_files", label: "Identifying key files" },
  { key: "tutorial_abstractions", label: "Identifying core concepts" },
  { key: "tutorial_relationships", label: "Mapping relationships" },
  { key: "tutorial_order", label: "Planning chapter order" },
  { key: "tutorial_chapters", label: "Writing tutorial chapters" },
  { key: "learning_concepts", label: "Extracting role-based concepts" },
  { key: "learning_graph", label: "Building skill dependency graph" },
  { key: "learning_lessons", label: "Generating lesson content" },
  { key: "learning_resources", label: "Curating learning resources" },
  { key: "exercises", label: "Creating exercises" },
] as const;
```

### Updated `hooks/use-processing.ts`

New SSE event handlers in the `processLine` switch:

```typescript
case "learning_concepts":
  markStepDone("learning_concepts");
  setResults((prev) => ({
    ...prev,
    learningPathV2: {
      ...prev.learningPathV2,
      concepts: event.data,
    },
  }));
  break;

case "learning_graph":
  markStepDone("learning_graph");
  setResults((prev) => ({
    ...prev,
    learningPathV2: {
      ...prev.learningPathV2,
      graph: event.data,
    },
  }));
  break;

case "learning_lessons":
  markStepDone("learning_lessons");
  setResults((prev) => ({
    ...prev,
    learningPathV2: {
      ...prev.learningPathV2,
      lessons: event.data,
    },
  }));
  break;

case "learning_resources":
  markStepDone("learning_resources");
  setResults((prev) => ({
    ...prev,
    learningPathV2: {
      ...prev.learningPathV2,
      resources: event.data,
    },
  }));
  break;

case "learning_path":
  // Final assembled result
  setResults((prev) => ({
    ...prev,
    learningPath: event.data as LearningPathV2,
  }));
  break;
```

---

## 5. Rate Limiting & Resilience

### Strategy: Sequential pipelines, single calls per step

The tutorial pipeline and learning path pipeline **never run concurrently**. The learning path starts after the tutorial finishes. This prevents the deep model from being hit by both pipelines simultaneously.

Within the learning path pipeline:
- All 4 steps are sequential (each depends on the previous)
- Each step is a **single LLM call** (not per-concept loops)
- **Total new LLM calls: 4** — minimal API pressure

### Call sequence (full pipeline)

```
Tutorial Pipeline (sequential):
  1. identifyAbstractions       → fast model
  2. analyzeRelationships       → fast model
  3. orderChapters              → fast model
  4. writeChapter (×N)          → deep model (sequential, one at a time)

[Tutorial complete — breathing room]

Learning Path Pipeline (sequential):
  5. roleConceptExtraction      → fast model
  6. dependencyGraph            → fast model
  7. lessonContentGeneration    → deep model (single call, all concepts)
  8. resourceCuration           → fast model

Exercises (parallel with learning path):
  9. generateExercises          → deep model
```

**Risk:** Step 7 (deep) and Step 9 (deep) may overlap since exercises run in parallel with the learning path. Mitigation: The existing per-model rate limiter in `gemini.ts` handles this — if both hit the deep model simultaneously, one queues behind the other. Alternatively, we can start exercises after Step 7 completes to fully serialize deep model usage.

### Retry & graceful degradation

- Each step gets 3 retries using the existing retry pattern with exponential backoff
- If Step 4 (resources) fails after retries, the learning path still renders with lesson content but empty resource cards + a "Resources unavailable" message
- If Step 3 (lessons) fails, we fall back to showing just the skill tree with concept names and the gap analysis — still valuable
- If Step 1 or 2 fails, we fall back to the old V1 learning path generation (single call)

### Timing estimate

| Step | Model | Estimated Time |
|------|-------|---------------|
| Concept extraction | fast | ~10-15s |
| Dependency graph | fast | ~10-15s |
| Lesson content | deep | ~30-45s |
| Resource curation | fast | ~10-15s |
| **Learning path total** | | **~60-90s** |
| **Full pipeline (tutorial + LP + exercises)** | | **~5-8 min** |

---

## 6. UI — Skill Tree (Hero Visual)

### Layout

A node-graph visualization where each concept is a node connected by directional edges showing prerequisites. Rendered as SVG with a DAG layout algorithm.

### Node states

| State | Visual | When |
|-------|--------|------|
| **Ready** | Full color, subtle pulse animation | Prerequisites met (or no prerequisites) |
| **Locked** | Dimmed/greyed, dotted border | Prerequisites not yet completed |
| **In Progress** | Ring progress indicator around node | User clicked "Start" |
| **Completed** | Checkmark overlay, accent fill, glow | User marked complete |

### Node content (collapsed)

- Icon based on `category` (framework, pattern, language, tooling, architecture, library)
- Concept name
- Difficulty dots (1-5)
- Estimated time badge (e.g., "15 min")

### Interaction

Click a node → slide-out detail panel showing:
- **Explanation** section (100-200 words, the "diagnosis")
- **"In Your Codebase"** section with file path references
- **Key Takeaways** bullet points
- **Resources** section with curated platform cards (see Section 8)
- **"Mark as Complete"** button
- **Prerequisites list** — links to prerequisite nodes

### Rendering approach

- **Layout algorithm:** `dagre` or `elkjs` for automatic DAG positioning
- **Rendering:** Custom React SVG components for nodes (full styling control), SVG `<path>` elements for edges
- **No heavyweight charting library** — we need full control over node appearance and interaction
- **Zoom/pan:** CSS transform-based with scroll-to-zoom and drag-to-pan

### Responsive behavior

On viewports < 768px, the skill tree collapses into a **linear path view**:
- Vertical list ordered by dependency (topological sort)
- Each concept is a card with expand/collapse
- Prerequisite indicators shown as "Requires: X, Y" badges
- Same interaction: tap to expand → see lesson + resources

---

## 7. UI — Module Dashboard & Progress

### Top bar

- **Role badge** — e.g., "Frontend Developer" with pencil icon to re-select role
- **Overall progress ring** — "7 of 18 concepts completed"
- **Skill level badge** — "Intermediate"
- **Time remaining** — "~3.5 hours remaining"

### Gap analysis banner

Prominent section above the skill tree:

```
Based on your intermediate skill level as a Frontend Developer:

You likely already know: JSX syntax, component props, basic event handling, CSS modules
Focus areas for your role: Server components, data fetching patterns, auth middleware, API route handlers
```

Styled as a distinct card with a subtle gradient background. This is the "wow, it actually understands my situation" moment.

### Module cards grid (below skill tree)

A grid of cards, one per module:
- Circular progress ring (X of Y concepts completed)
- Module title + description
- Concept count + total estimated time
- Color-coded to match the module cluster in the skill tree

Click a module card → skill tree scrolls/zooms to that module's cluster.

Acts as quick-nav and gives the "data-dense SaaS dashboard" feel.

---

## 8. UI — Resource Cards (Partnership Surface)

### Card design

```
┌─────────────────────────────────────────────────┐
│  [Platform Badge]  Coursera                     │
│                                                 │
│  React Hooks In-Depth: State & Effects    →     │
│                                                 │
│  "Covers the exact useState + useEffect         │
│   patterns used in your project's components"   │
│                                                 │
│  ┌──────┐  ┌──────────┐  ┌─────────┐  ┌──────┐ │
│  │Course│  │Intermed. │  │ 4 hours │  │ Free │ │
│  └──────┘  └──────────┘  └─────────┘  └──────┘ │
│                                                 │
│  [ Continue on Coursera → ]                     │
└─────────────────────────────────────────────────┘
```

### Grouped by intent

Within each concept's detail panel, resources are grouped:

- **"Start Here"** — Free, beginner-friendly entry points. Shown first.
- **"Go Deeper"** — Paid courses, longer-form content for mastery. Shown second.
- **"Quick Reference"** — Docs and cheat sheets for ongoing use. Shown last.

### Price transparency

Each card shows a small badge:
- `Free` (green) — No cost to access
- `Paid` (orange) — One-time purchase
- `Subscription` (blue) — Requires platform subscription

This is a trust feature. Users know what to expect before clicking.

### Future partnership readiness

- `platform` field in data model maps to a future `partners` config with logos, affiliate URLs, tracking params
- Card layout has a dedicated logo slot (currently renders colored badge, ready for real images)
- Resource URLs are structured for easy swap to affiliate/tracked links
- The design itself is the pitch: "imagine your logo here"

---

## 9. Configure Page Changes

### Role selection

Add a role selection step to the configure page, after skill level selection:

**Preset role cards** — 6 cards in a 2×3 or 3×2 grid:
- Each card shows icon, role title, one-line description
- Click to select (single selection, highlighted border)
- Matches the neo-brutalist design language (border-3, shadow, rounded-[4px])

**Custom role fallback** — Below the preset cards:
- "Or describe your role" text input
- Appears as a subtle secondary option
- Placeholder: "e.g., Data engineer learning the API layer"

**The selected role is passed through the processing pipeline** as part of the request body. If no role is selected, defaults to "fullstack_dev" preset.

---

## 10. Data Storage

### localStorage (`lib/project-sessions.ts`)

The `ProjectSession.learningPath` field currently holds a `LearningPath` (V1). After this change:
- New sessions store `LearningPathV2` in the same field
- Old sessions still have `LearningPathV1` data
- The `isV2LearningPath()` type guard distinguishes them at render time
- The Results page renders the old accordion UI for V1 sessions, new skill tree for V2

### Supabase

#### New migration

```sql
-- Add role and learning path V2 columns
ALTER TABLE learning_paths
ADD COLUMN role JSONB DEFAULT NULL,
ADD COLUMN skill_graph JSONB DEFAULT NULL,
ADD COLUMN gap_analysis JSONB DEFAULT NULL,
ADD COLUMN version INTEGER DEFAULT 1;

COMMENT ON COLUMN learning_paths.role IS 'RoleProfile: preset role or custom description';
COMMENT ON COLUMN learning_paths.skill_graph IS 'SkillNode[], SkillEdge[], SkillModule[] for V2 paths';
COMMENT ON COLUMN learning_paths.gap_analysis IS 'GapAnalysis: likelyKnown, focusAreas, summary';
COMMENT ON COLUMN learning_paths.version IS '1 = legacy flat modules, 2 = skill graph';
```

#### `lib/supabase/db.ts` updates

- `saveLearningPath` — detect V2 via `isV2LearningPath()`, save to new columns
- `loadLearningPath` — check `version` column, return appropriate type

### Progress persistence

Concept completion status is tracked client-side in localStorage initially. The `SkillNode.status` field updates when users mark concepts complete. Future phase: sync to Supabase `learning_progress` table for authenticated users.

---

## 11. New Dependencies

```bash
npm install dagre
npm install -D @types/dagre
```

| Package | Purpose | Size Impact |
|---------|---------|-------------|
| `dagre` | DAG layout algorithm for skill tree node positioning | ~30KB |

**Why dagre:** Lightweight, well-established, specifically designed for directed graph layouts. No runtime dependencies. The alternative `elkjs` is more powerful but ~200KB.

**No other new deps needed:**
- SVG rendering: Custom React components (no library needed)
- Zoom/pan: CSS transforms + pointer events (no library needed)
- Progress rings: SVG `<circle>` with `stroke-dasharray` (no library needed)

---

## 12. Implementation Phases

### Phase 1: Pipeline & Types (backend)

1. Rewrite `types/learning.ts` — new types + backward compat aliases
2. Add 4 new prompt functions to `lib/ai/prompts.ts`
3. Create `lib/ai/learning-pipeline.ts` — 4-step pipeline with validation
4. Update `app/api/process/route.ts` — integrate new pipeline, SSE events
5. Update `lib/constants.ts` — new processing steps
6. Update `hooks/use-processing.ts` — new event handlers
7. Update `app/(main)/configure/page.tsx` — role selection UI

**Deliverable:** The pipeline runs, SSE events fire, data is generated. Results page still shows old accordion UI but with richer data logged to console.

### Phase 2: Skill Tree UI (hero visual)

1. Create `components/results/skill-tree.tsx` — SVG node graph with dagre layout
2. Create `components/results/skill-node.tsx` — Individual node component with states
3. Create `components/results/skill-edge.tsx` — SVG edge paths
4. Create `components/results/concept-detail-panel.tsx` — Slide-out panel for node details
5. Update `components/results/learning-path-tab.tsx` — Render skill tree for V2, old accordion for V1

**Deliverable:** Interactive skill tree renders with click-to-expand nodes. No resource cards yet, no progress tracking.

### Phase 3: Resource Cards & Dashboard

1. Create `components/results/resource-card.tsx` — Premium resource card component
2. Create `components/results/learning-dashboard.tsx` — Top bar, gap analysis banner, module grid
3. Create `components/results/progress-ring.tsx` — SVG circular progress component
4. Integrate resource cards into concept detail panel
5. Integrate dashboard above skill tree

**Deliverable:** Full UI with skill tree + dashboard + resource cards. Progress tracking works client-side.

### Phase 4: Data Storage & Polish

1. Create Supabase migration for V2 columns
2. Update `lib/supabase/db.ts` — save/load V2 learning paths
3. Mobile responsive: linear path view for small screens
4. Error boundaries and loading states
5. Animate node state transitions

**Deliverable:** Production-ready feature with persistence, responsiveness, and polish.

---

## Risk & Mitigation

| Risk | Mitigation |
|------|------------|
| Pipeline adds ~60-90s to processing | Granular SSE events show progress; runs after tutorial so user already has content to browse |
| LLM generates hallucinated URLs | Prompt constrains to well-known platforms with predictable URL patterns; future: HEAD request validation |
| Skill tree layout looks bad on complex graphs | Dagre handles DAG layout well; cap at 20 concepts; fallback to linear view |
| Large SVG performance on 20+ nodes | Dagre is efficient; nodes are simple SVG groups; no canvas needed at this scale |
| Role selection adds friction to configure page | Default to "Full-Stack Developer" if skipped; role cards are quick to click |
| Backward compat with V1 sessions | Type guard `isV2LearningPath()` switches rendering; old data untouched |
| Deep model rate limits during Step 3 | Single call for all lessons (not per-concept); exercises wait or serialize behind it |
