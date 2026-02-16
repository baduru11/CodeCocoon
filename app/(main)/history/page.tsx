"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectSessions } from "@/hooks/use-project-sessions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  BookOpen,
  ArrowRight,
  Trash2,
  Calendar,
  FileCode,
  GitBranch,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function HistoryPage() {
  const { sessions, removeSession, setActiveSession, isLoaded } =
    useProjectSessions();
  const router = useRouter();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleOpenProject = (id: string) => {
    setActiveSession(id);
    router.push("/results");
  };

  const handleDelete = (id: string) => {
    removeSession(id);
    setConfirmDeleteId(null);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <BookOpen size={48} className="mx-auto mb-4 text-muted" />
        <h1 className="text-4xl font-bold mb-3">No History Yet</h1>
        <p className="text-muted font-medium mb-8 max-w-lg mx-auto">
          Connect a GitHub repository and run an analysis to see your history
          here.
        </p>
        <Link href="/connect">
          <Button size="lg" className="gap-2">
            Connect a Repo <ArrowRight size={18} />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">History</h1>
        <p className="text-muted font-medium text-sm mt-1">
          {sessions.length} analyzed{" "}
          {sessions.length === 1 ? "repository" : "repositories"}
        </p>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => {
          const isConfirming = confirmDeleteId === session.id;
          const date = new Date(session.analyzedAt);

          return (
            <div
              key={session.id}
              className={cn(
                "bg-surface border-2 border-foreground rounded-lg shadow-[4px_4px_0px_0px_#1E293B]",
                "transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[3px_3px_0px_0px_#1E293B]"
              )}
            >
              <div className="flex items-center justify-between p-5">
                {/* Left: repo info — clickable */}
                <button
                  onClick={() => handleOpenProject(session.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <GitBranch size={16} className="shrink-0 text-secondary" />
                    <h2 className="text-lg font-bold truncate">
                      {session.repoName}
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {date.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCode size={12} />
                      {session.projectData.fileCount} files
                    </span>
                    {session.skillLevel && (
                      <span className="px-2 py-0.5 bg-accent-yellow/20 border border-accent-yellow/40 rounded-[2px] font-bold">
                        {session.skillLevel}
                      </span>
                    )}
                    {session.exercises.length > 0 && (
                      <span className="px-2 py-0.5 bg-accent-green/20 border border-accent-green/40 rounded-[2px] font-bold">
                        {session.exercises.length} exercises
                      </span>
                    )}
                  </div>
                </button>

                {/* Right: actions */}
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  {session.repoUrl && (
                    <a
                      href={session.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 border-2 border-foreground/20 rounded-lg text-muted hover:text-foreground hover:border-foreground transition-colors"
                      title="Open on GitHub"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}

                  {isConfirming ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(session.id)}
                        className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-3 py-1.5 text-xs font-bold bg-surface border-2 border-foreground/20 rounded-lg hover:border-foreground transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="p-2 border-2 border-foreground/20 rounded-lg text-muted hover:text-red-500 hover:border-red-500 transition-colors"
                      title="Delete project"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Connect another repo */}
      <div className="mt-8 text-center">
        <Link href="/connect">
          <Button variant="outline" className="gap-2">
            Analyze another repo <ArrowRight size={16} />
          </Button>
        </Link>
      </div>
    </div>
  );
}
