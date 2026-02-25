"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, LayoutDashboard, GitBranch, BookOpen, Bug,
  GraduationCap, Calendar, Trash2, ActivitySquare
} from "lucide-react";
import Link from "next/link";
import type { FetchTreeResult } from "@/types/github";

interface SavedProject {
  id: string;
  repoName: string;
  date: string;
  techStack: string[];
  fileCount: number;
  status: string;
  githubUrl: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { value: treeData, removeValue: clearTreeData } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [, setLoadingSavedProjects] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      setLoadingSavedProjects(true);
      fetch("/api/projects/list")
        .then(r => {
          if (!r.ok) throw new Error("Failed to load projects");
          return r.json();
        })
        .then(data => setSavedProjects(data.projects || []))
        .catch(err => console.error("Failed to load saved projects:", err))
        .finally(() => setLoadingSavedProjects(false));
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (!user) return null;

  const totalProjects = savedProjects.length;
  const totalFiles = savedProjects.reduce((sum, p) => sum + (p.fileCount || 0), 0);
  const allTech = [...new Set(savedProjects.flatMap((p) => p.techStack ?? []))];

  const handleDeleteProject = async (id: string) => {
    setDeletingId(id);
    try {
      const project = savedProjects.find((p) => p.id === id);
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSavedProjects((prev) => prev.filter((p) => p.id !== id));
        // Clear treeData if it belongs to the deleted project
        if (project && treeData?.repoName === project.repoName) {
          clearTreeData();
        }
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className="max-w-5xl w-full mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-accent-red border-2 border-foreground rounded-brutal-sm shadow-brutal text-surface">
          <ActivitySquare size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-heading font-bold uppercase tracking-tight">System_Dashboard</h1>
          <p className="text-muted font-mono text-sm border-l-2 border-accent-red pl-3 mt-1">
            USER_ID: {user.user_metadata?.user_name || "AUTHORIZED_DEVELOPER"} // STATUS: ONLINE
          </p>
        </div>
      </div>

      {/* Quick Stats — derived from saved projects */}
      {totalProjects > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <Card className="rounded-brutal-sm border-foreground bg-surface">
            <CardContent className="pt-6 text-center flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-foreground text-surface rounded-brutal-sm mb-3">
                <GitBranch size={24} />
              </div>
              <p className="font-mono font-bold text-3xl">{totalProjects}</p>
              <p className="text-xs text-muted font-bold tracking-widest mt-1">REPOSITORIES_MAPPED</p>
            </CardContent>
          </Card>
          <Card className="rounded-brutal-sm border-foreground bg-surface">
            <CardContent className="pt-6 text-center flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-red text-surface rounded-brutal-sm mb-3">
                <BookOpen size={24} />
              </div>
              <p className="font-mono font-bold text-3xl">{totalFiles}</p>
              <p className="text-xs text-muted font-bold tracking-widest mt-1">ARTIFACTS_ANALYZED</p>
            </CardContent>
          </Card>
          <Card className="rounded-brutal-sm border-foreground bg-surface">
            <CardContent className="pt-6 text-center flex flex-col items-center">
              <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-foreground bg-surface text-foreground rounded-brutal-sm mb-3">
                <GraduationCap size={24} />
              </div>
              <p className="font-mono font-bold text-3xl">{allTech.length}</p>
              <p className="text-xs text-muted font-bold tracking-widest mt-1">TECHNOLOGIES_FOUND</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Saved Analyses */}
      {savedProjects.length > 0 && (
        <div className="mb-12">
          <h2 className="text-sm font-mono font-bold tracking-widest text-muted mb-4 border-b-2 border-foreground/10 pb-2">ARCHIVED_TOPOLOGIES</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedProjects.map((project) => (
              <div
                key={project.id}
                className="relative text-left p-4 bg-surface border-2 border-foreground rounded-brutal-sm shadow-brutal-sm brutal-hover"
              >
                <button
                  onClick={() => router.push("/results")}
                  className="cursor-pointer w-full text-left"
                >
                  <div className="font-heading font-bold text-lg mb-2 truncate pr-8">{project.repoName}</div>
                  <div className="flex items-center gap-2 mb-3 font-mono text-xs text-muted">
                    <Calendar size={12} />
                    [{new Date(project.date).toLocaleDateString()}]
                    {project.fileCount > 0 && (
                      <span className="ml-1 text-accent-red">· {project.fileCount} NOC</span>
                    )}
                  </div>
                  {(project.techStack ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-auto">
                      {project.techStack.slice(0, 4).map((tech) => (
                        <span key={tech} className="px-2 py-0.5 text-[10px] font-mono font-bold bg-foreground text-surface rounded-sm">
                          {tech}
                        </span>
                      ))}
                      {project.techStack.length > 4 && (
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-foreground/10 text-foreground rounded-sm">
                          +{project.techStack.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </button>
                {/* Delete button */}
                {confirmDeleteId === project.id ? (
                  <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      disabled={deletingId === project.id}
                      className="cursor-pointer px-2 py-1 text-[10px] font-mono font-bold bg-accent-red text-surface border-2 border-foreground rounded-sm shadow-[2px_2px_0px_0px_#111111] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50"
                    >
                      {deletingId === project.id ? <Loader2 size={10} className="animate-spin" /> : "PURGE"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="cursor-pointer px-2 py-1 text-[10px] font-mono font-bold bg-surface border-2 border-foreground rounded-sm hover:bg-foreground hover:text-surface transition-colors"
                    >
                      ABORT
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(project.id)}
                    className="cursor-pointer absolute top-3 right-3 p-1.5 border-2 border-transparent rounded-sm text-muted hover:text-accent-red hover:border-accent-red transition-colors z-10"
                    title="Delete project"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <h2 className="text-sm font-mono font-bold tracking-widest text-muted mb-4 border-b-2 border-foreground/10 pb-2">COMMAND_MODULES</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/connect" className="block h-full">
          <Card className="h-full rounded-brutal-sm brutal-hover cursor-pointer border-foreground bg-surface">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
              <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-foreground bg-surface rounded-brutal-sm mb-4">
                <GitBranch size={24} className="text-foreground" />
              </div>
              <p className="font-heading font-bold text-lg mb-1 uppercase tracking-tight">Init_Analysis</p>
              <p className="font-mono text-xs text-muted">CONNECT_GITHUB_SOURCE</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/results" className="block h-full">
          <Card className="h-full rounded-brutal-sm brutal-hover cursor-pointer border-foreground bg-surface">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-foreground text-surface rounded-brutal-sm mb-4">
                <BookOpen size={24} />
              </div>
              <p className="font-heading font-bold text-lg mb-1 uppercase tracking-tight">View_Telemetry</p>
              <p className="font-mono text-xs text-muted">ACCESS_SAVED_PROTOCOLS</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/exercises" className="block h-full">
          <Card className="h-full rounded-brutal-sm brutal-hover cursor-pointer border-foreground bg-surface">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-red text-surface rounded-brutal-sm mb-4">
                <Bug size={24} />
              </div>
              <p className="font-heading font-bold text-lg mb-1 uppercase tracking-tight">Execute_Drills</p>
              <p className="font-mono text-xs text-muted">BEGIN_SYNTAX_TRAINING</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
