"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, LayoutDashboard, GitBranch, BookOpen, Bug,
  GraduationCap, Calendar, Trash2,
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
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-accent-yellow border-2 border-foreground rounded-lg shadow-[4px_4px_0px_0px_#1E293B]">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted font-medium">
            Welcome back, {user.user_metadata?.user_name || "developer"}!
          </p>
        </div>
      </div>

      {/* Quick Stats — derived from saved projects */}
      {totalProjects > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="rounded-xl border-foreground/15 bg-primary/5">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-3">
                <GitBranch size={24} className="text-primary" />
              </div>
              <p className="font-bold text-2xl">{totalProjects}</p>
              <p className="text-xs text-muted font-bold">Projects Analyzed</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-foreground/15 bg-secondary/5">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary/10 rounded-xl mb-3">
                <BookOpen size={24} className="text-secondary" />
              </div>
              <p className="font-bold text-2xl">{totalFiles}</p>
              <p className="text-xs text-muted font-bold">Total Files</p>
            </CardContent>
          </Card>
          <Card className="rounded-xl border-foreground/15 bg-accent-yellow/5">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent-yellow/10 rounded-xl mb-3">
                <GraduationCap size={24} className="text-accent-yellow" />
              </div>
              <p className="font-bold text-2xl">{allTech.length}</p>
              <p className="text-xs text-muted font-bold">Technologies</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Saved Analyses */}
      {savedProjects.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Saved Analyses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedProjects.map((project) => (
              <div
                key={project.id}
                className="relative text-left p-4 bg-surface border-2 border-foreground/15 rounded-xl shadow-[3px_3px_0px_0px_rgba(30,41,59,0.15)] hover:border-foreground/30 hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(30,41,59,0.15)] transition-all"
              >
                <button
                  onClick={() => router.push("/results")}
                  className="cursor-pointer w-full text-left"
                >
                  <div className="font-bold text-sm mb-2 truncate pr-8">{project.repoName}</div>
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted">
                    <Calendar size={12} />
                    {new Date(project.date).toLocaleDateString()}
                    {project.fileCount > 0 && (
                      <span className="ml-1">· {project.fileCount} files</span>
                    )}
                  </div>
                  {(project.techStack ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {project.techStack.slice(0, 4).map((tech) => (
                        <Badge key={tech} variant="primary" className="text-xs">
                          {tech}
                        </Badge>
                      ))}
                      {project.techStack.length > 4 && (
                        <Badge variant="primary" className="text-xs">
                          +{project.techStack.length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                </button>
                {/* Delete button */}
                {confirmDeleteId === project.id ? (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <button
                      onClick={() => handleDeleteProject(project.id)}
                      disabled={deletingId === project.id}
                      className="cursor-pointer px-2 py-1 text-[10px] font-bold bg-red-500 text-white border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50"
                    >
                      {deletingId === project.id ? <Loader2 size={10} className="animate-spin" /> : "Delete"}
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="cursor-pointer px-2 py-1 text-[10px] font-bold bg-surface border-2 border-foreground/15 rounded-lg hover:border-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(project.id)}
                    className="cursor-pointer absolute top-3 right-3 p-1.5 border-2 border-foreground/15 rounded-lg text-muted hover:text-red-500 hover:border-red-500 transition-colors"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/connect">
          <Card className="h-full rounded-xl border-foreground/15 hover:border-foreground/30 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-secondary/10 rounded-2xl mb-4">
                <GitBranch size={28} className="text-secondary" />
              </div>
              <p className="font-bold mb-1">Analyze a Project</p>
              <p className="text-xs text-muted">Connect a GitHub repo</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/results">
          <Card className="h-full rounded-xl border-foreground/15 hover:border-foreground/30 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
                <BookOpen size={28} className="text-primary" />
              </div>
              <p className="font-bold mb-1">View Results</p>
              <p className="text-xs text-muted">Analysis results & learning paths</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/exercises">
          <Card className="h-full rounded-xl border-foreground/15 hover:border-foreground/30 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-accent-yellow/10 rounded-2xl mb-4">
                <Bug size={28} className="text-accent-yellow" />
              </div>
              <p className="font-bold mb-1">Practice Exercises</p>
              <p className="text-xs text-muted">Bug hunts & code challenges</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
