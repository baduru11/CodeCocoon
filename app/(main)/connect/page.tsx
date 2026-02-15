"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useProjectSessions } from "@/hooks/use-project-sessions";
import { Link2, GitBranch, Upload, ArrowRight, Loader2, FileCode, X, AlertCircle, Search } from "lucide-react";
import Link from "next/link";
import type { FetchRepoResult, GitHubRepo, FetchTreeResult } from "@/types/github";


export default function ConnectPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { value: treeData, setValue: setTreeData, removeValue: clearTreeData } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const { setValue: setProjectData } = useLocalStorage<FetchRepoResult | null>("projectData", null);
  const { sessions } = useProjectSessions();

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoSearch, setRepoSearch] = useState("");
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");

  // Upload state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const parseRepoName = (urlOrOwnerRepo: string): string | null => {
    // Handle full URL
    const urlMatch = urlOrOwnerRepo.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`;
    // Handle owner/repo shorthand
    if (urlOrOwnerRepo.includes("/")) return urlOrOwnerRepo;
    return null;
  };

  const checkDuplicate = (urlOrOwnerRepo: string): boolean => {
    const repoName = parseRepoName(urlOrOwnerRepo);
    if (!repoName) return false;
    // Check if this repo exists in history (completed analyses)
    const inHistory = sessions.some((s) => s.repoName === repoName);
    if (inHistory) return true;
    // Check current treeData — only if there's no stale state
    if (treeData?.repoName === repoName) {
      // treeData matches but no session exists — stale, clear it
      clearTreeData();
    }
    return false;
  };

  const handleFetchUrl = async (skipDuplicateCheck = false) => {
    if (!url.trim()) {
      setError("Please enter a GitHub URL");
      return;
    }

    if (!skipDuplicateCheck && checkDuplicate(url)) {
      setShowDuplicateWarning(true);
      setPendingUrl(url);
      return;
    }

    setLoading(true);
    setError("");
    setShowDuplicateWarning(false);

    try {
      const res = await fetch("/api/github/tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repository");
      }

      const data: FetchTreeResult = await res.json();
      setTreeData(data);
      router.push("/configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchRepo = async (owner: string, repo: string, skipDuplicateCheck = false) => {
    const repoFullName = `${owner}/${repo}`;

    if (!skipDuplicateCheck && checkDuplicate(repoFullName)) {
      setShowDuplicateWarning(true);
      setPendingUrl(repoFullName);
      return;
    }

    setLoading(true);
    setError("");
    setShowDuplicateWarning(false);

    try {
      const res = await fetch("/api/github/tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repository");
      }

      const data: FetchTreeResult = await res.json();
      setTreeData(data);
      router.push("/configure");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  // Auto-load repos when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingRepos(true);
    fetch("/api/github/repos")
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => setRepos(data.repos))
      .catch(() => { /* Silently fail — repos are optional */ })
      .finally(() => setLoadingRepos(false));
  }, [isAuthenticated]);

  // Upload handlers
  const handleUploadFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    setUploadFiles((prev) => [...prev, ...Array.from(newFiles)]);
    setUploadError("");
  }, []);

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (uploadFiles.length === 0) {
      setUploadError("Please select some files");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      uploadFiles.forEach((file) => formData.append("files", file));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data: FetchRepoResult = await res.json();
      setProjectData(data);
      router.push("/configure");
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Connect Your Project</h1>
        <p className="text-muted font-medium text-lg">
          Paste a GitHub repo URL or browse your repositories
        </p>
      </div>

      {/* Duplicate Warning */}
      {showDuplicateWarning && (
        <Card className="mb-8 border-accent-yellow bg-accent-yellow/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-accent-yellow shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-bold mb-3">You've already analyzed this repo.</p>
                <div className="flex gap-2">
                  <Link href="/results">
                    <Button variant="secondary" size="sm">
                      View Previous Results
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDuplicateWarning(false);
                      // pendingUrl is either a full URL or "owner/repo" from repo list
                      const parsed = parseRepoName(pendingUrl);
                      if (parsed) {
                        const [owner, repo] = parsed.split("/");
                        handleFetchRepo(owner, repo, true);
                      } else {
                        handleFetchUrl(true);
                      }
                    }}
                  >
                    Analyze Again
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* URL Input */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 size={20} />
            Paste Repository URL
          </CardTitle>
          <CardDescription>Works with any public GitHub repository — no login required</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
              />
            </div>
            <Button onClick={() => handleFetchUrl()} disabled={loading} className="gap-2">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Analyze
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm font-bold text-red-500">{error}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-4 mb-8">
        <div className="flex-1 h-[3px] bg-foreground/20" />
        <span className="font-bold text-muted text-sm">OR</span>
        <div className="flex-1 h-[3px] bg-foreground/20" />
      </div>

      {/* GitHub Repos */}
      {isAuthenticated ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch size={20} />
              Your Repositories
            </CardTitle>
            <CardDescription>Select a repo from your GitHub account</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingRepos ? (
              <div className="flex items-center gap-2 text-sm text-muted font-medium py-4 justify-center">
                <Loader2 size={16} className="animate-spin" />
                Loading your repositories...
              </div>
            ) : repos.length === 0 ? (
              <p className="text-sm text-muted font-medium text-center py-4">
                No public repositories found.
              </p>
            ) : (
              <>
              {repos.length > 6 && (
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <Input
                    placeholder="Search repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                {repos.filter((repo) => {
                  if (!repoSearch.trim()) return true;
                  const q = repoSearch.toLowerCase();
                  return (
                    repo.full_name.toLowerCase().includes(q) ||
                    repo.name.toLowerCase().includes(q) ||
                    (repo.description?.toLowerCase().includes(q) ?? false) ||
                    (repo.language?.toLowerCase().includes(q) ?? false)
                  );
                }).map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => handleFetchRepo(repo.owner.login, repo.name, false)}
                    disabled={loading}
                    className="text-left p-4 bg-surface border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
                  >
                    <div className="font-bold text-sm truncate">{repo.full_name}</div>
                    {repo.description && (
                      <p className="text-xs text-muted mt-1 line-clamp-2">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      {repo.language && <Badge variant="secondary">{repo.language}</Badge>}
                    </div>
                  </button>
                ))}
              </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8">
          <CardContent className="text-center py-8">
            <GitBranch size={32} className="mx-auto mb-3 text-muted" />
            <p className="font-bold mb-2">Want to browse your repos?</p>
            <p className="text-sm text-muted mb-4">Login with GitHub to access your repositories</p>
            <Link href="/login?next=/connect">
              <Button variant="secondary" className="gap-2">
                <GitBranch size={16} />
                Login with GitHub
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Upload Files — inline drop zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={20} />
            Upload Files
          </CardTitle>
          <CardDescription>Drag and drop your project files directly</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleUploadFiles(e.dataTransfer.files);
            }}
            className={`relative p-8 text-center border-3 border-dashed rounded-[4px] transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-foreground/30 hover:border-foreground/60"
            }`}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleUploadFiles(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.html,.css,.json,.yaml,.yml,.md,.sql,.sh"
            />
            <Upload size={32} className="mx-auto mb-3 text-muted" />
            <p className="font-bold mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted font-medium">
              .ts, .tsx, .js, .py, .go, .java, .html, .css, .json, and more
            </p>
          </div>

          {/* Selected files */}
          {uploadFiles.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <FileCode size={14} />
                  {uploadFiles.length} file{uploadFiles.length !== 1 ? "s" : ""} selected
                </span>
                <Button size="sm" variant="ghost" onClick={() => setUploadFiles([])} className="text-primary text-xs">
                  Clear all
                </Button>
              </div>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {uploadFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between p-2 bg-background rounded-[4px] border-2 border-foreground/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode size={12} className="shrink-0" />
                      <span className="text-xs font-medium truncate">{file.name}</span>
                      <Badge variant="default" className="text-[10px]">{(file.size / 1024).toFixed(1)} KB</Badge>
                    </div>
                    <button onClick={() => removeUploadFile(i)} className="p-1 hover:bg-primary/10 rounded-[4px]">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full mt-3 gap-2"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Analyze {uploadFiles.length} File{uploadFiles.length !== 1 ? "s" : ""}
              </Button>
            </div>
          )}

          {uploadError && (
            <p className="mt-3 text-sm font-bold text-primary">{uploadError}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
