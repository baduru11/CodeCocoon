"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useProjectSessions } from "@/hooks/use-project-sessions";
import { Link2, GitBranch, Upload, ArrowRight, Loader2, FileCode, X, AlertCircle, Search, FolderOpen } from "lucide-react";
import Link from "next/link";
import type { FetchRepoResult, GitHubRepo, FetchTreeResult } from "@/types/github";


/** Recursively read all files from dropped DataTransfer items (handles folders). */
async function readDroppedEntries(
  items: DataTransferItemList
): Promise<{ file: File; path: string }[]> {
  const result: { file: File; path: string }[] = [];

  const readAllEntries = (
    reader: FileSystemDirectoryReader
  ): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => {
      const all: FileSystemEntry[] = [];
      const readBatch = () => {
        reader.readEntries((batch) => {
          if (batch.length === 0) resolve(all);
          else {
            all.push(...batch);
            readBatch();
          }
        }, reject);
      };
      readBatch();
    });

  const readEntry = async (
    entry: FileSystemEntry,
    parentPath: string
  ): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(resolve, reject);
      });
      result.push({ file, path: parentPath + entry.name });
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await readAllEntries(reader);
      for (const e of entries) {
        await readEntry(e, parentPath + entry.name + "/");
      }
    }
  };

  for (const item of Array.from(items)) {
    const entry = item.webkitGetAsEntry?.();
    if (entry) {
      await readEntry(entry, "");
    }
  }

  return result;
}

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
  const [uploadFiles, setUploadFiles] = useState<{ file: File; path: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

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
  const addUploadFiles = useCallback((newFiles: { file: File; path: string }[]) => {
    if (newFiles.length === 0) return;
    setUploadFiles((prev) => [...prev, ...newFiles]);
    setUploadError("");
  }, []);

  const handleFileInput = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      addUploadFiles(Array.from(fileList).map((f) => ({ file: f, path: f.name })));
    },
    [addUploadFiles]
  );

  const handleFolderInput = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      addUploadFiles(
        Array.from(fileList).map((f) => ({
          file: f,
          path: f.webkitRelativePath || f.name,
        }))
      );
    },
    [addUploadFiles]
  );

  const handleUploadDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (e.dataTransfer.items?.length) {
        const hasDir = Array.from(e.dataTransfer.items).some(
          (item) => item.webkitGetAsEntry?.()?.isDirectory
        );
        if (hasDir) {
          const entries = await readDroppedEntries(e.dataTransfer.items);
          addUploadFiles(entries);
          return;
        }
      }
      if (e.dataTransfer.files) {
        handleFileInput(e.dataTransfer.files);
      }
    },
    [addUploadFiles, handleFileInput]
  );

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
      uploadFiles.forEach(({ file, path }) => formData.append("files", file, path));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data: FetchRepoResult = await res.json();
      setProjectData(data);

      // Build synthetic treeData so the configure page works for uploads
      const syntheticTree: FetchTreeResult = {
        files: data.files.map((f) => ({
          path: f.path,
          sha: "",
          size: f.size,
          language: f.language,
          excluded: false,
        })),
        excludedFiles: [],
        repoName: data.repoName,
        owner: "__upload__",
        repo: data.repoName,
        totalFiles: data.fileCount,
        totalExcludedFiles: 0,
        totalSize: data.totalSize,
        languages: data.languages,
        filterSummary: {
          totalScanned: data.fileCount,
          totalIncluded: data.fileCount,
          totalExcluded: 0,
          excludedByReason: {
            too_large: 0,
            binary_file: 0,
            ignored_directory: 0,
            unsupported_extension: 0,
            non_file: 0,
          },
        },
      };
      setTreeData(syntheticTree);
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary/10 border border-secondary/30 rounded-full text-xs font-bold text-secondary mb-4">
          <Link2 size={14} />
          Get Started
        </div>
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
                <p className="font-bold mb-3">You&apos;ve already analyzed this repo.</p>
                <div className="flex gap-2">
                  <Link href="/results">
                    <Button variant="secondary" size="sm" className="cursor-pointer">
                      View Previous Results
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
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
      <Card className="mb-8 rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 size={20} />
            Paste Repository URL
          </CardTitle>
          <CardDescription>Works with any public GitHub repository -- no login required</CardDescription>
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
            <Button onClick={() => handleFetchUrl()} disabled={loading} className="gap-2 cursor-pointer">
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
        <div className="flex-1 h-px bg-foreground/10" />
        <span className="font-bold text-muted/60 text-xs uppercase tracking-widest px-3">or</span>
        <div className="flex-1 h-px bg-foreground/10" />
      </div>

      {/* GitHub Repos */}
      {isAuthenticated ? (
        <Card className="mb-8 border-foreground/15 rounded-xl">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="cursor-pointer text-left p-4 bg-surface border-2 border-foreground/15 rounded-xl shadow-[3px_3px_0px_0px_rgba(30,41,59,0.15)] hover:border-foreground/30 hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all disabled:opacity-50"
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
        <Card className="mb-8 border-foreground/15 rounded-xl">
          <CardContent className="text-center py-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-secondary/10 rounded-2xl mb-4">
              <GitBranch size={28} className="text-secondary" />
            </div>
            <p className="font-bold mb-2">Want to browse your repos?</p>
            <p className="text-sm text-muted mb-5">Login with GitHub to access your repositories</p>
            <Link href="/login?next=/connect">
              <Button variant="secondary" className="gap-2 cursor-pointer">
                <GitBranch size={16} />
                Login with GitHub
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Upload Files — inline drop zone */}
      <Card className="border-foreground/15 rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload size={20} />
            Upload Files
          </CardTitle>
          <CardDescription>Drag and drop your project files or folders directly</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Hidden inputs */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => { handleFileInput(e.target.files); e.target.value = ""; }}
            className="hidden"
            accept=".ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.html,.css,.json,.yaml,.yml,.md,.sql,.sh"
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error webkitdirectory is a non-standard attribute not in React types
            webkitdirectory=""
            onChange={(e) => { handleFolderInput(e.target.files); e.target.value = ""; }}
            className="hidden"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleUploadDrop}
            className={`p-10 text-center border-2 border-dashed rounded-xl transition-all ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-foreground/20 hover:border-foreground/40 hover:bg-surface/50"
            }`}
          >
            <div className="inline-flex items-center justify-center w-14 h-14 bg-foreground/5 rounded-2xl mb-4">
              <Upload size={28} className="text-muted" />
            </div>
            <p className="font-bold mb-1">
              Drop files or folders here
            </p>
            <p className="text-xs text-muted font-medium mb-4">
              .ts, .tsx, .js, .py, .go, .java, .html, .css, .json, and more
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 cursor-pointer"
              >
                <FileCode size={14} />
                Browse Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="gap-2 cursor-pointer"
              >
                <FolderOpen size={14} />
                Browse Folder
              </Button>
            </div>
          </div>

          {/* Selected files */}
          {uploadFiles.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                  <FileCode size={14} />
                  {uploadFiles.length} file{uploadFiles.length !== 1 ? "s" : ""} selected
                </span>
                <Button size="sm" variant="ghost" onClick={() => setUploadFiles([])} className="text-primary text-xs cursor-pointer">
                  Clear all
                </Button>
              </div>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {uploadFiles.map(({ file, path }, i) => (
                  <div
                    key={`${path}-${i}`}
                    className="flex items-center justify-between p-2.5 bg-background rounded-xl border border-foreground/10"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileCode size={12} className="shrink-0 text-muted" />
                      <span className="text-xs font-medium truncate">{path}</span>
                      <Badge variant="default" className="text-[10px]">{(file.size / 1024).toFixed(1)} KB</Badge>
                    </div>
                    <button onClick={() => removeUploadFile(i)} className="cursor-pointer p-1.5 hover:bg-primary/10 rounded-lg transition-colors">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full mt-4 gap-2 cursor-pointer"
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
