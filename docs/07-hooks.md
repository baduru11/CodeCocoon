# CodeCocoon — Custom Hooks

All hooks in `hooks/`. Client-side only (include `"use client"` in consuming components).

---

## `hooks/use-processing.ts` — SSE Stream Parser

The most complex hook. Manages the SSE connection to `/api/process` and assembles incremental results.

```typescript
"use client";
import { useState, useCallback, useRef } from "react";
// ... imports

type ProcessingStatus = "idle" | "processing" | "complete" | "error";

interface ProcessingStep {
  key: string;
  label: string;
  done: boolean;
  startedAt?: number;
  completedAt?: number;
}

export interface ProcessingResults {
  projectData?: FetchRepoResult;
  analysis?: Partial<AnalysisResult>;
  learningPath?: LearningPath;
  exercises?: Exercise[];
}

export function useProcessing() {
  const [status, setStatus] = useState<ProcessingStatus>("idle");
  const [currentStep, setCurrentStep] = useState("");
  const [steps, setSteps] = useState<ProcessingStep[]>(
    PROCESSING_STEPS.map((s) => ({ ...s, done: false }))
  );
  const [results, setResults] = useState<ProcessingResults>({});
  const [error, setError] = useState("");
  const completedRef = useRef(false);

  const process = useCallback(async (config: ProcessConfig) => {
    // 1. Build requestBody — for uploads, reads projectData from localStorage
    // 2. POST to /api/process
    // 3. Read SSE stream via reader.read() loop
    // 4. Parse each "data: {...}" line as AnalysisStreamEvent
    // 5. Dispatch to correct setResults() call per event type
    // 6. On "complete" → setStatus("complete")
    // 7. If stream ends without "complete" → setStatus("error")
  }, [markStepDone, markStepStarted]);

  const completedSteps = steps.filter((s) => s.done).length;
  const progressPercent = (completedSteps / steps.length) * 100;

  return { status, currentStep, steps, results, error, process, completedSteps, progressPercent };
}
```

### SSE Parsing Logic
```
buffer += decoder.decode(chunk, { stream: true })
lines = buffer.split("\n\n")
buffer = lines.pop() // Save incomplete line

For each line starting with "data: ":
  event = JSON.parse(line.slice(6))
  dispatch to setResults() based on event.type
```

### Key Implementation Details
- `completedRef.current` guards against calling `setStatus("complete")` twice
- Tutorial chapters accumulate incrementally: `chapters: [...existing, chapter]`
- `complete` event merges with incremental results: uses `??` to prefer complete payload
- Only `SyntaxError` is swallowed; real errors re-thrown

---

## `hooks/use-auth.ts`

```typescript
"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return {
    user,
    session,
    loading,
    providerToken: session?.provider_token ?? null,
    isAuthenticated: !!user,
  };
}
```

---

## `hooks/use-local-storage.ts`

Generic typed localStorage hook with SSR safety.

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, defaultValue: T) {
  const [value, setValue] = useState<T>(defaultValue);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setValue(JSON.parse(stored) as T);
      }
    } catch { /* ignore */ }
    setIsLoaded(true);
  }, [key]);

  const setStoredValue = useCallback((newValue: T) => {
    setValue(newValue);
    try {
      if (newValue === null || newValue === undefined) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(newValue));
      }
    } catch { /* ignore */ }
  }, [key]);

  return { value, setValue: setStoredValue, isLoaded };
}
```

Usage:
```typescript
const { value: processConfig, isLoaded } = useLocalStorage<ProcessConfig | null>("processConfig", null);
```

---

## `hooks/use-project-sessions.ts`

Wraps `lib/project-sessions.ts` in React state. Provides reactive access to sessions.

```typescript
"use client";
export function useProjectSessions() {
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [activeSession, setActiveSessionState] = useState<ProjectSession | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const all = getAllSessions();
    const active = getActiveSession();
    const favs = getFavoriteIds();
    setSessions(all);
    setActiveSessionState(active);
    setFavoriteIds(favs);
    setIsLoaded(true);
  }, []);

  const deleteSessionById = useCallback((id: string) => {
    deleteSession(id);
    setSessions(getAllSessions());
    setActiveSessionState(getActiveSession());
  }, []);

  const toggleFavoriteById = useCallback((id: string) => {
    const newFavs = toggleFavorite(id);
    setFavoriteIds(new Set(newFavs));
  }, []);

  return { sessions, activeSession, favoriteIds, isLoaded, deleteSessionById, toggleFavoriteById };
}
```

---

## `hooks/use-analysis.ts`

Simple hook that reads analysis data from the active localStorage session.

```typescript
"use client";
export function useAnalysis() {
  const { activeSession } = useProjectSessions();
  return {
    analysisData: activeSession?.analysisData ?? null,
    projectData: activeSession?.projectData ?? null,
    learningPath: activeSession?.learningPath ?? null,
    exercises: activeSession?.exercises ?? [],
    isLoaded: !!activeSession,
  };
}
```

---

## `hooks/use-scrollspy.ts`

Tracks which section ID is currently visible in the viewport using IntersectionObserver.

```typescript
"use client";
import { useEffect, useState } from "react";

export function useScrollspy(ids: string[], rootMargin = "-20% 0px -70% 0px"): string {
  const [activeId, setActiveId] = useState(ids[0] ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [ids, rootMargin]);

  return activeId;
}
```

Usage in results page:
```typescript
const TUTORIAL_SECTION_IDS = ["overview", "architecture", "tech-stack", "key-files"];
const activeId = useScrollspy(TUTORIAL_SECTION_IDS);
```
