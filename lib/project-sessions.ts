import type { ProjectSession } from "@/types/project-session";
import type { Exercise } from "@/types/exercise";

const SESSIONS_KEY = "projectSessions";
const ACTIVE_KEY = "activeSessionId";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getAllSessions(): ProjectSession[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ProjectSession[];
  } catch {
    console.warn("Failed to parse project sessions from localStorage");
    return [];
  }
}

export function getSession(id: string): ProjectSession | null {
  const sessions = getAllSessions();
  return sessions.find((s) => s.id === id) ?? null;
}

export function saveSession(session: ProjectSession): void {
  if (!isBrowser()) return;
  try {
    const sessions = getAllSessions();
    const existingIndex = sessions.findIndex((s) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.unshift(session);
    }
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (err) {
    console.warn("Failed to save project session:", err);
  }
}

export function deleteSession(id: string): void {
  if (!isBrowser()) return;
  try {
    const sessions = getAllSessions().filter((s) => s.id !== id);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    const activeId = getActiveSessionId();
    if (activeId === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
  } catch (err) {
    console.warn("Failed to delete project session:", err);
  }
}

export function getActiveSessionId(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACTIVE_KEY) ?? null;
}

export function setActiveSessionId(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(ACTIVE_KEY, id);
}

export function getActiveSession(): ProjectSession | null {
  const id = getActiveSessionId();
  if (!id) return null;
  return getSession(id);
}

export function updateSessionExercises(
  id: string,
  exercises: Exercise[]
): void {
  const session = getSession(id);
  if (!session) return;
  session.exercises = exercises;
  saveSession(session);
}
