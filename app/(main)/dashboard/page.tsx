"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, LayoutDashboard, GitBranch, BookOpen, Bug,
  ArrowRight, Layers, GraduationCap, Calendar,
} from "lucide-react";
import Link from "next/link";
import type { FetchRepoResult } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";
import type { AssessmentResult } from "@/types/assessment";
import type { LearningPath } from "@/types/learning";
import { SKILL_LEVELS } from "@/lib/constants";

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
  const { value: projectData } = useLocalStorage<FetchRepoResult | null>("projectData", null);
  const { value: analysisData } = useLocalStorage<AnalysisResult | null>("analysisData", null);
  const { value: assessmentData } = useLocalStorage<AssessmentResult | null>("assessmentData", null);
  const { value: learningPath } = useLocalStorage<LearningPath | null>("learningPath", null);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [loadingSavedProjects, setLoadingSavedProjects] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?next=/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (user) {
      setLoadingSavedProjects(true);
      fetch("/api/projects/list")
        .then(r => r.json())
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

  const hasProject = !!projectData;
  const hasAnalysis = !!analysisData;
  const hasAssessment = !!assessmentData;
  const hasLearning = !!learningPath;
  const level = assessmentData ? SKILL_LEVELS[assessmentData.skillLevel] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-accent-yellow border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A]">
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted font-medium">
            Welcome back, {user.user_metadata?.user_name || "developer"}!
          </p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className={hasProject ? "" : "opacity-50"}>
          <CardContent className="pt-6 text-center">
            <GitBranch size={24} className="mx-auto mb-2" />
            <p className="font-bold text-2xl">{projectData?.fileCount || 0}</p>
            <p className="text-xs text-muted font-bold">Files Analyzed</p>
          </CardContent>
        </Card>
        <Card className={hasAnalysis ? "" : "opacity-50"}>
          <CardContent className="pt-6 text-center">
            <Layers size={24} className="mx-auto mb-2" />
            <p className="font-bold text-2xl">{analysisData?.techStack?.frameworks?.length || 0}</p>
            <p className="text-xs text-muted font-bold">Technologies</p>
          </CardContent>
        </Card>
        <Card className={hasAssessment ? "" : "opacity-50"}>
          <CardContent className="pt-6 text-center">
            <GraduationCap size={24} className="mx-auto mb-2" />
            <p className="font-bold text-2xl">{level ? level.emoji : "—"}</p>
            <p className="text-xs text-muted font-bold">{level ? level.label : "Not Assessed"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Saved Analyses */}
      {savedProjects.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Saved Analyses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {savedProjects.map((project) => (
              <button
                key={project.id}
                onClick={() => {
                  router.push("/results");
                }}
                className="text-left p-4 bg-surface border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
              >
                <div className="font-bold text-sm mb-2 truncate">{project.repoName}</div>
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
            ))}
          </div>
        </div>
      )}

      {/* Project Info */}
      {hasProject && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch size={18} />
              Current Project
            </CardTitle>
            <CardDescription>{projectData?.repoName}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {analysisData?.techStack?.frameworks?.map((f) => (
                <Badge key={f} variant="secondary">{f}</Badge>
              ))}
              {analysisData?.techStack?.languages?.map((l) => (
                <Badge key={l} variant="primary">{l}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assessment Score */}
      {hasAssessment && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap size={18} />
              Skill Assessment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={assessmentData!.score}
              label={`Score: ${assessmentData!.score}%`}
              color={assessmentData!.score >= 70 ? "bg-accent-green" : assessmentData!.score >= 40 ? "bg-accent-yellow" : "bg-primary"}
            />
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!hasProject && (
          <Link href="/connect">
            <Card className="h-full hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all cursor-pointer">
              <CardContent className="pt-6 text-center">
                <GitBranch size={32} className="mx-auto mb-3" />
                <p className="font-bold mb-1">Connect a Project</p>
                <p className="text-xs text-muted">Link your GitHub repo to get started</p>
              </CardContent>
            </Card>
          </Link>
        )}
        {hasProject && !hasAssessment && (
          <Link href="/assess">
            <Card className="h-full hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all cursor-pointer">
              <CardContent className="pt-6 text-center">
                <GraduationCap size={32} className="mx-auto mb-3" />
                <p className="font-bold mb-1">Take Assessment</p>
                <p className="text-xs text-muted">Find your skill level</p>
              </CardContent>
            </Card>
          </Link>
        )}
        <Link href="/results">
          <Card className="h-full hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all cursor-pointer">
            <CardContent className="pt-6 text-center">
              <BookOpen size={32} className="mx-auto mb-3" />
              <p className="font-bold mb-1">{hasLearning ? "View Results" : "Analyze a Project"}</p>
              <p className="text-xs text-muted">Analysis results & learning paths</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/exercises">
          <Card className="h-full hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all cursor-pointer">
            <CardContent className="pt-6 text-center">
              <Bug size={32} className="mx-auto mb-3" />
              <p className="font-bold mb-1">Practice Exercises</p>
              <p className="text-xs text-muted">Bug hunts & code challenges</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/connect">
          <Card className="h-full hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all cursor-pointer">
            <CardContent className="pt-6 text-center">
              <ArrowRight size={32} className="mx-auto mb-3" />
              <p className="font-bold mb-1">Analyze New Project</p>
              <p className="text-xs text-muted">Connect a different repo</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
