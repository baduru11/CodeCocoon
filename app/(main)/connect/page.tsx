"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Link2, GitBranch, Upload, ArrowRight, Loader2, FolderOpen, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { FetchRepoResult, GitHubRepo, FetchTreeResult } from "@/types/github";
import type { AnalysisResult } from "@/types/analysis";

export default function ConnectPage() {
  const router = useRouter();
  const { isAuthenticated, providerToken } = useAuth();
  const { setValue: setTreeData } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const { value: treeData } = useLocalStorage<FetchTreeResult | null>("treeData", null);

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [pendingUrl, setPendingUrl] = useState("");

  const parseRepoName = (urlOrOwnerRepo: string): string | null => {
    // Handle full URL
    const urlMatch = urlOrOwnerRepo.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (urlMatch) return `${urlMatch[1]}/${urlMatch[2]}`;
    // Handle owner/repo shorthand
    if (urlOrOwnerRepo.includes("/")) return urlOrOwnerRepo;
    return null;
  };

  const checkDuplicate = (urlOrOwnerRepo: string): boolean => {
    if (!treeData) return false;
    const repoName = parseRepoName(urlOrOwnerRepo);
    return repoName === treeData.repoName;
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

  const loadRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await fetch("/api/github/repos");
      if (res.ok) {
        const data = await res.json();
        setRepos(data.repos);
      }
    } catch {
      // Silently fail — repos are optional
    } finally {
      setLoadingRepos(false);
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
                  <Link href="/configure">
                    <Button variant="secondary" size="sm">
                      View Previous Results
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowDuplicateWarning(false);
                      handleFetchUrl(true);
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
            {repos.length === 0 ? (
              <Button onClick={loadRepos} disabled={loadingRepos} variant="outline" className="gap-2">
                {loadingRepos ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                Load My Repos
              </Button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
                {repos.map((repo) => (
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
                      {repo.private && <Badge variant="warning">Private</Badge>}
                    </div>
                  </button>
                ))}
              </div>
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

      {/* Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={20} />
            Upload Files
          </CardTitle>
          <CardDescription>Drag and drop your project files directly</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/upload">
            <Button variant="outline" className="gap-2">
              <Upload size={16} />
              Go to File Upload
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
