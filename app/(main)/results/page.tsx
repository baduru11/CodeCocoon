"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProjectSessions } from "@/hooks/use-project-sessions";
import { useAuth } from "@/hooks/use-auth";
import { useScrollspy } from "@/hooks/use-scrollspy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Loader2,
  BookOpen,
  Layers,
  LayoutGrid,
  FileCode,
  Save,
  CheckCircle2,
  Link2,
} from "lucide-react";
import Link from "next/link";
import { SectionTabs } from "@/components/results/section-tabs";
import { LearningPathTab } from "@/components/results/learning-path-tab";
import { ExercisesTab } from "@/components/results/exercises-tab";
import type { TabId } from "@/components/results/section-tabs";

const SECTION_IDS = ["summary", "architecture", "tech-stack", "key-files"];
const SECTION_LABELS: Record<string, { label: string; icon: typeof BookOpen }> = {
  summary: { label: "Summary", icon: BookOpen },
  architecture: { label: "Architecture", icon: LayoutGrid },
  "tech-stack": { label: "Tech Stack", icon: Layers },
  "key-files": { label: "Key Files", icon: FileCode },
};

export default function ResultsPage() {
  const { activeSession, isLoaded } = useProjectSessions();
  const { isAuthenticated } = useAuth();
  const activeId = useScrollspy(SECTION_IDS);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Redirect to history if no active session
  useEffect(() => {
    if (isLoaded && !activeSession) {
      router.replace("/history");
    }
  }, [isLoaded, activeSession, router]);

  const handleSave = async () => {
    if (!activeSession) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/projects/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectData: activeSession.projectData,
          analysisData: activeSession.analysisData,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(data.error || "Failed to save project");
      }
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  // Loading or no session — show spinner (useEffect handles redirect)
  if (!isLoaded || !activeSession) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  const { analysisData, learningPath } = activeSession;
  const { techStack, architecture, keyFiles, summary } = analysisData;

  return (
    <div className="max-w-[90%] mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{activeSession.repoName}</h1>
        <p className="text-muted font-medium text-sm mt-1">
          {activeSession.projectData.fileCount} files analyzed ·{" "}
          {new Date(activeSession.analyzedAt).toLocaleDateString()}
        </p>
      </div>

      {/* Tab Bar */}
      <div className="mb-8">
        <SectionTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          exerciseProgress={{
            completed: 0,
            total: activeSession.exercises?.length || 0,
          }}
        />
      </div>

      {/* Tab Content — all rendered, CSS display toggles visibility */}

      {/* Summary Tab */}
      <div style={{ display: activeTab === "summary" ? "block" : "none" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
          {/* LEFT: Table of Contents */}
          <nav className="hidden lg:block">
            <div className="sticky top-20 space-y-1">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3 px-3">
                Contents
              </p>
              {SECTION_IDS.map((id) => {
                const section = SECTION_LABELS[id];
                const Icon = section.icon;
                const isActive = activeId === id;

                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-[4px] text-sm font-medium transition-all border-l-3",
                      isActive
                        ? "bg-secondary/10 text-secondary font-bold border-secondary"
                        : "text-muted hover:text-foreground border-transparent hover:border-foreground/20"
                    )}
                  >
                    <Icon size={14} />
                    {section.label}
                  </a>
                );
              })}
            </div>
          </nav>

          {/* Mobile TOC */}
          <div className="lg:hidden mb-4 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {SECTION_IDS.map((id) => {
                const section = SECTION_LABELS[id];
                const isActive = activeId === id;
                return (
                  <a
                    key={id}
                    href={`#${id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 rounded-[4px] text-xs font-bold border-2 transition-all",
                      isActive
                        ? "bg-secondary text-white border-foreground"
                        : "bg-surface text-muted border-foreground/20"
                    )}
                  >
                    {section.label}
                  </a>
                );
              })}
            </div>
          </div>

          {/* CENTER: Content */}
          <main className="min-w-0 space-y-10">
            {/* Summary */}
            <section id="summary">
              <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                <BookOpen size={20} />
                Summary
              </h2>
              {summary ? (
                <div className="space-y-4">
                  {summary.split("\n\n").map((paragraph, i) => (
                    <p key={i} className="text-lg leading-relaxed font-medium">
                      {paragraph}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-muted font-medium">No summary available.</p>
              )}
            </section>

            {/* Architecture */}
            <section id="architecture">
              <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                <LayoutGrid size={20} />
                Architecture
              </h2>
              {architecture ? (
                <div>
                  <div className="mb-4">
                    <Badge variant="secondary" className="text-sm px-3 py-1">
                      {architecture.pattern}
                    </Badge>
                    <p className="mt-3 font-medium leading-relaxed">
                      {architecture.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {architecture.layers.map((layer, i) => (
                      <Card key={i} className="border-2">
                        <CardContent className="pt-4 pb-4">
                          <p className="font-bold text-sm mb-1">{layer.name}</p>
                          <p className="text-xs text-muted mb-2">{layer.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {layer.files.slice(0, 4).map((f) => (
                              <span
                                key={f}
                                className="text-[10px] font-mono bg-surface px-1.5 py-0.5 border border-foreground/20 rounded-[2px]"
                              >
                                {f}
                              </span>
                            ))}
                            {layer.files.length > 4 && (
                              <span className="text-[10px] font-mono text-muted px-1.5 py-0.5">
                                +{layer.files.length - 4} more
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  {architecture.entryPoints.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-muted mb-2">Entry Points</p>
                      <div className="flex flex-wrap gap-1.5">
                        {architecture.entryPoints.map((ep) => (
                          <span
                            key={ep}
                            className="text-xs font-mono bg-accent-yellow/20 px-2 py-0.5 border border-accent-yellow/40 rounded-[2px]"
                          >
                            {ep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted font-medium">No architecture data available.</p>
              )}
            </section>

            {/* Tech Stack */}
            <section id="tech-stack">
              <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                <Layers size={20} />
                Tech Stack
              </h2>
              {techStack ? (
                <div className="space-y-4">
                  {techStack.languages.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted mb-2">Languages</p>
                      <div className="flex flex-wrap gap-1.5">
                        {techStack.languages.map((l) => (
                          <Badge key={l} variant="primary">
                            {l}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {techStack.frameworks.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted mb-2">Frameworks</p>
                      <div className="flex flex-wrap gap-1.5">
                        {techStack.frameworks.map((f) => (
                          <Badge key={f} variant="secondary">
                            {f}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {techStack.databases.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted mb-2">Databases</p>
                      <div className="flex flex-wrap gap-1.5">
                        {techStack.databases.map((d) => (
                          <Badge key={d} variant="success">
                            {d}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {techStack.tools.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted mb-2">Tools</p>
                      <div className="flex flex-wrap gap-1.5">
                        {techStack.tools.map((t) => (
                          <Badge key={t} variant="warning">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {techStack.styling.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-muted mb-2">Styling</p>
                      <div className="flex flex-wrap gap-1.5">
                        {techStack.styling.map((s) => (
                          <Badge key={s}>{s}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted font-medium">No tech stack data available.</p>
              )}
            </section>

            {/* Key Files */}
            <section id="key-files">
              <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                <FileCode size={20} />
                Key Files
              </h2>
              {keyFiles && keyFiles.length > 0 ? (
                <div className="space-y-2">
                  {keyFiles.map((file, i) => (
                    <div
                      key={i}
                      className="p-3 border-2 border-foreground/15 rounded-[4px] hover:border-foreground/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-sm font-mono font-bold text-secondary">
                          {file.path}
                        </code>
                        <Badge variant="default" className="text-[10px]">
                          {file.role}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted font-medium">{file.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted font-medium">No key files identified.</p>
              )}
            </section>
          </main>
        </div>
      </div>

      {/* Learning Path Tab */}
      <div style={{ display: activeTab === "learn" ? "block" : "none" }}>
        <LearningPathTab learningPath={learningPath} />
      </div>

      {/* Exercises Tab */}
      <div style={{ display: activeTab === "exercises" ? "block" : "none" }}>
        <ExercisesTab session={activeSession} />
      </div>

      {/* Save to Dashboard */}
      {isAuthenticated && (
        <div className="mt-10 flex justify-center">
          {saved ? (
            <div className="flex items-center gap-2 text-accent-green font-bold">
              <CheckCircle2 size={20} />
              Saved to Dashboard
            </div>
          ) : (
            <div className="text-center">
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="outline"
                className="gap-2"
              >
                {saving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Save to Dashboard
              </Button>
              {saveError && (
                <p className="text-xs font-bold text-primary mt-2">{saveError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* New Project Link */}
      <div className="mt-6 text-center">
        <Link
          href="/connect"
          className="inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-foreground transition-colors"
        >
          <Link2 size={14} />
          Analyze another repo
        </Link>
      </div>
    </div>
  );
}
