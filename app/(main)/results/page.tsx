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
  Link2,
  Save,
  CheckCircle2,
} from "lucide-react";
import Link from "next/link";
import { ChatPanel } from "@/components/chat/chat-panel";
import { SectionTabs } from "@/components/results/section-tabs";
import { LearningPathTab } from "@/components/results/learning-path-tab";
import { ExercisesTab } from "@/components/results/exercises-tab";
import { TutorialOverview } from "@/components/results/tutorial-overview";
import { TutorialChapter } from "@/components/results/tutorial-chapter";
import type { TabId } from "@/components/results/section-tabs";

function extractOwnerRepo(repoUrl: string) {
  const urlParts = repoUrl.replace(/\/$/, "").split("/");
  const githubRepo = urlParts.pop() || "";
  const githubOwner = urlParts.pop() || "";
  return { githubOwner, githubRepo };
}

const TUTORIAL_SECTION_IDS = ["overview", "architecture", "tech-stack", "key-files"];
const TUTORIAL_SECTION_LABELS: Record<string, { label: string; icon: typeof BookOpen }> = {
  overview: { label: "Overview", icon: BookOpen },
  architecture: { label: "Architecture", icon: LayoutGrid },
  "tech-stack": { label: "Tech Stack", icon: Layers },
  "key-files": { label: "Key Files", icon: FileCode },
};

export default function ResultsPage() {
  const { activeSession, isLoaded } = useProjectSessions();
  const { isAuthenticated } = useAuth();
  const activeId = useScrollspy(TUTORIAL_SECTION_IDS);
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Redirect to history if no active session
  useEffect(() => {
    if (isLoaded && !activeSession) {
      router.replace("/history");
    }
  }, [isLoaded, activeSession, router]);

  // Check if this project is already saved to dashboard
  useEffect(() => {
    if (!isAuthenticated || !activeSession) return;

    const { githubOwner, githubRepo } = extractOwnerRepo(activeSession.repoUrl);
    if (!githubOwner || !githubRepo) return;

    fetch("/api/projects/check-duplicate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ githubOwner, githubRepo }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.exists) setSaved(true);
      })
      .catch((err) => console.warn("Failed to check duplicate status:", err));
  }, [isAuthenticated, activeSession]);

  const handleSave = async () => {
    if (!activeSession || saving || saved) return;
    setSaving(true);
    setSaveError(null);

    const { githubOwner, githubRepo } = extractOwnerRepo(activeSession.repoUrl);

    try {
      const res = await fetch("/api/projects/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoName: activeSession.repoName,
          githubOwner,
          githubRepo,
          githubUrl: activeSession.repoUrl,
          files: activeSession.projectData.files,
          analysis: activeSession.analysisData,
          learningPath: activeSession.learningPath,
          exercises: activeSession.exercises,
          skillLevel: activeSession.skillLevel,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
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
  const { techStack, architecture, keyFiles, summary, tutorial } = analysisData;

  return (
    <div className="max-w-[90%] mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">{activeSession.repoName}</h1>
          {isAuthenticated && (
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              variant="secondary"
              size="sm"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Saving...
                </>
              ) : saved ? (
                <>
                  <CheckCircle2 size={14} className="mr-1.5" />
                  Saved
                </>
              ) : (
                <>
                  <Save size={14} className="mr-1.5" />
                  Save to Dashboard
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-muted font-medium text-sm mt-1">
          {activeSession.projectData.fileCount} files analyzed ·{" "}
          {new Date(activeSession.analyzedAt).toLocaleDateString()}
        </p>
        {saveError && (
          <p className="text-red-500 text-sm mt-1">{saveError}</p>
        )}
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

      {/* Tutorial Tab */}
      <div style={{ display: activeTab === "summary" ? "block" : "none" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* LEFT: Combined Contents Navigation */}
          <nav className="hidden lg:block">
            <div className="sticky top-20 p-3 bg-surface/50 border border-foreground/8 rounded-xl">
              <p className="text-xs font-bold text-muted uppercase tracking-wider mb-3 px-3">
                Contents
              </p>
              <div className="space-y-0.5">
                {/* Overview */}
                {tutorial && tutorial.chapters?.length > 0 && (
                  <a
                    href="#overview"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedChapter(null);
                      setTimeout(() => {
                        document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" });
                      }, 50);
                    }}
                    className={cn(
                      "cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border-l-2",
                      selectedChapter === null
                        ? "bg-secondary/10 text-secondary font-bold border-secondary"
                        : "text-muted hover:text-foreground border-transparent hover:border-foreground/20"
                    )}
                  >
                    <BookOpen size={14} />
                    Overview
                  </a>
                )}

                {/* Chapters */}
                {tutorial && tutorial.chapters?.length > 0 && (
                  <>
                    {tutorial.chapters.map((chapter, i) => {
                      const isActive = selectedChapter === i;
                      return (
                        <button
                          key={chapter.filename}
                          onClick={() => { setSelectedChapter(i); window.scrollTo({ top: 0 }); }}
                          className={cn(
                            "w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border-l-2",
                            isActive
                              ? "bg-secondary/10 text-secondary font-bold border-secondary"
                              : "text-muted hover:text-foreground border-transparent hover:border-secondary/30"
                          )}
                        >
                          <span className="shrink-0 w-5 h-5 flex items-center justify-center bg-secondary/10 text-secondary font-bold text-xs rounded">
                            {i + 1}
                          </span>
                          <span className="truncate">{chapter.name}</span>
                        </button>
                      );
                    })}
                  </>
                )}

                {/* Architecture, Tech Stack, Key Files - only on overview page */}
                {selectedChapter === null && (
                  <>
                    <div className="h-px bg-foreground/10 my-2" />
                    {["architecture", "tech-stack", "key-files"].map((id) => {
                      const section = TUTORIAL_SECTION_LABELS[id];
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
                            "cursor-pointer flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border-l-2",
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
                  </>
                )}
              </div>
            </div>
          </nav>

          {/* Mobile Navigation */}
          <div className="lg:hidden mb-4">
            <p className="text-xs font-bold text-muted uppercase tracking-wider mb-2">
              Contents
            </p>
            <div className="flex gap-2 pb-2 overflow-x-auto">
              {/* Overview */}
              {tutorial && tutorial.chapters?.length > 0 && (
                <a
                  href="#overview"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedChapter(null);
                    setTimeout(() => {
                      document.getElementById("overview")?.scrollIntoView({ behavior: "smooth" });
                    }, 50);
                  }}
                  className={cn(
                    "cursor-pointer whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all",
                    selectedChapter === null
                      ? "bg-secondary text-white border-foreground"
                      : "bg-surface text-muted border-foreground/15"
                  )}
                >
                  Overview
                </a>
              )}

              {/* Chapters */}
              {tutorial && tutorial.chapters?.length > 0 && (
                <>
                  {tutorial.chapters.map((chapter, i) => {
                    const isActive = selectedChapter === i;
                    return (
                      <button
                        key={chapter.filename}
                        onClick={() => { setSelectedChapter(i); window.scrollTo({ top: 0 }); }}
                        className={cn(
                          "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all",
                          isActive
                            ? "bg-secondary text-white border-foreground"
                            : "bg-surface text-muted border-foreground/15 hover:border-secondary/50"
                        )}
                      >
                        {i + 1}. {chapter.name}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Architecture, Tech Stack, Key Files - only on overview page */}
              {selectedChapter === null && (
                <>
                  <div className="w-px h-6 bg-foreground/20 self-center mx-1" />
                  {["architecture", "tech-stack", "key-files"].map((id) => {
                    const section = TUTORIAL_SECTION_LABELS[id];
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
                          "cursor-pointer whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all",
                          isActive
                            ? "bg-secondary text-white border-foreground"
                            : "bg-surface text-muted border-foreground/15"
                        )}
                      >
                        {section.label}
                      </a>
                    );
                  })}
                </>
              )}
            </div>
          </div>

          {/* CENTER: Content */}
          <main className="min-w-0">
            {selectedChapter !== null ? (
              /* Chapter view - only chapter content */
              <TutorialChapter
                chapter={tutorial!.chapters[selectedChapter]}
                chapterNum={selectedChapter + 1}
                totalChapters={tutorial!.chapters.length}
                onBack={() => { setSelectedChapter(null); window.scrollTo({ top: 0 }); }}
                onPrev={() => { setSelectedChapter((p) => Math.max(0, (p ?? 1) - 1)); window.scrollTo({ top: 0 }); }}
                onNext={() => { setSelectedChapter((p) => Math.min(tutorial!.chapters.length - 1, (p ?? 0) + 1)); window.scrollTo({ top: 0 }); }}
                onNavigateToChapter={(filename) => {
                  const idx = tutorial!.chapters.findIndex((c) => c.filename === filename);
                  if (idx !== -1) { setSelectedChapter(idx); window.scrollTo({ top: 0 }); }
                }}
              />
            ) : (
              /* Overview page with all analysis sections */
              <div className="space-y-12">
                <section id="overview">
                  {tutorial && tutorial.chapters?.length > 0 ? (
                    <TutorialOverview
                      tutorial={tutorial}
                      onSelectChapter={(i) => { setSelectedChapter(i); window.scrollTo({ top: 0 }); }}
                    />
                  ) : summary ? (
                    <div>
                      <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                        <BookOpen size={20} />
                        Overview
                      </h2>
                      <div className="space-y-4">
                        {summary.split("\n\n").map((paragraph, i) => (
                          <p key={i} className="text-lg leading-relaxed font-medium">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted font-medium">No overview available.</p>
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
                      <div className="mb-5">
                        <Badge variant="secondary" className="text-sm px-3 py-1">
                          {architecture.pattern}
                        </Badge>
                        <p className="mt-3 font-medium leading-relaxed">
                          {architecture.description}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {architecture.layers.map((layer, i) => (
                          <Card key={i} className="border-foreground/15 rounded-xl hover:border-foreground/25 transition-colors">
                            <CardContent className="pt-4 pb-4">
                              <p className="font-bold text-sm mb-1">{layer.name}</p>
                              <p className="text-xs text-muted mb-2">{layer.description}</p>
                              <div className="flex flex-wrap gap-1">
                                {layer.files.slice(0, 4).map((f) => (
                                  <span
                                    key={f}
                                    className="text-[10px] font-mono bg-surface px-1.5 py-0.5 border border-foreground/10 rounded-md"
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
                                className="text-xs font-mono bg-accent-yellow/15 px-2 py-0.5 border border-accent-yellow/30 rounded-md"
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
                          className="p-4 border border-foreground/10 rounded-xl hover:border-foreground/20 hover:bg-surface/50 transition-all"
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
              </div>
            )}
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

      {/* New Project Link */}
      <div className="mt-6 text-center">
        <Link
          href="/connect"
          className="cursor-pointer inline-flex items-center gap-1 text-sm font-bold text-muted hover:text-foreground transition-colors"
        >
          <Link2 size={14} />
          Analyze another repo
        </Link>
      </div>

      {/* Chat Panel */}
      <ChatPanel
        projectId={activeSession.ragProjectId || activeSession.repoName}
        repoName={activeSession.repoName}
        techStack={techStack}
        architecturePattern={architecture?.pattern}
        skillLevel={activeSession.skillLevel || "beginner"}
        roleLabel={activeSession.role?.displayName || "Developer"}
        conceptNames={
          learningPath && "nodes" in learningPath
            ? learningPath.nodes?.map((n: { name: string }) => n.name)
            : undefined
        }
      />
    </div>
  );
}
