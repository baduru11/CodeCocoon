"use client";

import { useState, useEffect, useCallback } from "react";
import type { ProjectSession } from "@/types/project-session";
import {
  getAllSessions,
  getActiveSessionId,
  setActiveSessionId as setActiveId,
  getSession,
  deleteSession as removeSessionFromStorage,
} from "@/lib/project-sessions";

export function useProjectSessions() {
  const [sessions, setSessions] = useState<ProjectSession[]>([]);
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setSessions(getAllSessions());
    setActiveSessionIdState(getActiveSessionId());
    setIsLoaded(true);
  }, []);

  const activeSession = activeSessionId
    ? sessions.find((s) => s.id === activeSessionId) ?? null
    : null;

  const setActiveSession = useCallback((id: string) => {
    setActiveId(id);
    setActiveSessionIdState(id);
  }, []);

  const removeSession = useCallback((id: string) => {
    removeSessionFromStorage(id);
    const updated = getAllSessions();
    setSessions(updated);
    if (activeSessionId === id) {
      const nextId = updated.length > 0 ? updated[0].id : null;
      if (nextId) {
        setActiveId(nextId);
      }
      setActiveSessionIdState(nextId);
    }
  }, [activeSessionId]);

  const refresh = useCallback(() => {
    setSessions(getAllSessions());
    setActiveSessionIdState(getActiveSessionId());
  }, []);

  return {
    sessions,
    activeSession,
    activeSessionId,
    setActiveSession,
    removeSession,
    isLoaded,
    refresh,
  };
}
