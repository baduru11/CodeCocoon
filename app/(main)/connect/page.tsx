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
import { IGNORED_DIRS, BINARY_EXTENSIONS } from "@/lib/constants";
import { Link2, GitBranch, Upload, ArrowRight, Loader2, FileCode, FolderOpen, X, AlertCircle, Search } from "lucide-react";
import Link from "next/link";
import type { RepoFile, GitHubRepo, FetchTreeResult } from "@/types/github";

interface UploadFile {
  file: File;
  path: string;
}

/** Check if any segment of a file path is in the ignored dirs list. */
function isIgnoredPath(filePath: string): boolean {
  const segments = filePath.split("/");
  return segments.some((seg) => IGNORED_DIRS.has(seg));
}

/** Check if a file has a binary extension. */
function isBinaryFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  return BINARY_EXTENSIONS.has(ext);
}

/** Recursively read files from dropped DataTransfer items (handles folders). */
async function getFilesFromDrop(dataTransfer: DataTransfer): Promise<UploadFile[]> {
  const results: UploadFile[] = [];
  const items = Array.from(dataTransfer.items);
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => entry != null);

  // If the browser doesn't support webkitGetAsEntry, fall back to flat file list
  if (entries.length === 0) {
    return Array.from(dataTransfer.files).map((f) => ({ file: f, path: f.name }));
  }

  async function readEntry(entry: FileSystemEntry, basePath: string) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry;
      const file = await new Promise<File>((resolve, reject) =>
        fileEntry.file(resolve, reject)
      );
      const fullPath = basePath + entry.name;
      if (!isIgnoredPath(fullPath) && !isBinaryFile(fullPath)) {
        results.push({ file, path: fullPath });
      }
    } else if (entry.isDirectory) {
      // Skip ignored directories entirely
      if (IGNORED_DIRS.has(entry.name)) return;

      const dirEntry = entry as FileSystemDirectoryEntry;
      const reader = dirEntry.createReader();
      // readEntries may not return all entries at once — call until empty
      let allEntries: FileSystemEntry[] = [];
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject)
        );
        allEntries = allEntries.concat(batch);
      } while (batch.length > 0);

      for (const child of allEntries) {
        await readEntry(child, basePath + entry.name + "/");
      }
    }
  }

  for (const entry of entries) {
    await readEntry(entry, "");
  }

  return results;
}

/** Extract UploadFile[] from a file input (supports webkitdirectory). */
function getFilesFromInput(fileList: FileList): UploadFile[] {
  const results: UploadFile[] = [];
  for (const file of Array.from(fileList)) {
    const path = file.webkitRelativePath || file.name;
    if (!isIgnoredPath(path) && !isBinaryFile(path)) {
      results.push({ file, path });
    }
  }
  return results;
}


export default function ConnectPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { value: treeData, setValue: setTreeData, removeValue: clearTreeData } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const { setValue: setUploadedFiles } = useLocalStorage<RepoFile[] | null>("uploadedFiles", null);
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
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
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
  const handleUploadFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const items = getFilesFromInput(newFiles);
    setUploadFiles((prev) => [...prev, ...items]);
    setUploadError("");
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const items = await getFilesFromDrop(e.dataTransfer);
    setUploadFiles((prev) => [...prev, ...items]);
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
      uploadFiles.forEach(({ file, path }) => formData.append("files", file, path));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }
      const data: { treeData: FetchTreeResult; fileContents: RepoFile[] } = await res.json();
      setTreeData(data.treeData);
      setUploadedFiles(data.fileContents);
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-foreground text-surface border-2 border-foreground rounded-brutal-sm text-xs font-mono font-bold tracking-widest shadow-brutal-sm mb-6 uppercase">
          <Link2 size={14} />
          Init_Connection
        </div>
        <h1 className="text-4xl md:text-5xl font-heading font-bold uppercase tracking-tight mb-4">Connect_Repository</h1>
        <p className="text-muted font-mono max-w-xl mx-auto border-l-2 border-accent-red pl-4 text-left">
          Link a GitHub source or upload raw artifacts. The protocol will ingest and map the architecture.
        </p>
      </div>

      {/* Duplicate Warning */}
      {showDuplicateWarning && (
        <Card className="mb-8 border-accent-red bg-surface shadow-[4px_4px_0px_0px_#E63B2E] rounded-brutal-sm">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertCircle size={24} className="text-accent-red shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-heading font-bold uppercase text-lg tracking-tight mb-2">Warning: Topology Already Exists</p>
                <p className="font-mono text-sm text-muted mb-4">This repository has already been mapped in your archives.</p>
                <div className="flex gap-3">
                  <Link href="/results">
                    <Button variant="outline" size="sm" className="cursor-pointer">
                      Access_Archive
                    </Button>
                  </Link>
                  <Button
                    variant="default"
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
                    Force_Reingest
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* URL Input */}
      <Card className="mb-8 rounded-brutal-sm border-foreground shadow-[4px_4px_0px_0px_#111111] bg-surface">
        <CardHeader className="border-b-2 border-foreground/10 pb-4">
          <CardTitle className="flex items-center gap-2 font-heading font-bold uppercase tracking-tight">
            <Link2 size={24} />
            Direct_Input_Stream
          </CardTitle>
          <CardDescription className="font-mono text-xs">Public GitHub repository URL mapping</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                className="w-full font-mono text-sm"
              />
            </div>
            <Button onClick={() => handleFetchUrl()} disabled={loading} className="gap-2 cursor-pointer w-full sm:w-auto h-12">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              Execute_Pull
            </Button>
          </div>
          {error && (
            <p className="mt-3 text-sm font-mono font-bold text-accent-red flex items-center gap-2 before:content-['>']">ERR: {error}</p>
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
        <Card className="mb-8 border-foreground rounded-brutal-sm shadow-[4px_4px_0px_0px_#111111] bg-surface">
          <CardHeader className="border-b-2 border-foreground/10 pb-4">
            <CardTitle className="flex items-center gap-2 font-heading font-bold uppercase tracking-tight">
              <GitBranch size={24} />
              Authenticated_Sources
            </CardTitle>
            <CardDescription className="font-mono text-xs">Select from available authorized repositories</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingRepos ? (
              <div className="flex items-center gap-2 text-sm font-mono text-muted py-4 justify-center">
                <Loader2 size={16} className="animate-spin" />
                Querying_GitHub_API...
              </div>
            ) : repos.length === 0 ? (
              <p className="text-sm font-mono text-muted text-center py-4">
                [NO_PUBLIC_REPOSITORIES_FOUND]
              </p>
            ) : (
              <>
                {repos.length > 6 && (
                  <div className="relative mb-6">
                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-foreground" />
                    <Input
                      placeholder="Search_Repositories..."
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      className="pl-10 font-mono"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
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
                      className="cursor-pointer text-left p-4 bg-background border-2 border-foreground rounded-brutal-sm brutal-hover transition-all disabled:opacity-50 flex flex-col h-full"
                    >
                      <div className="font-heading font-bold text-base truncate w-full mb-1">{repo.full_name}</div>
                      {repo.description && (
                        <p className="font-mono text-xs text-muted mb-4 line-clamp-2 border-l-2 border-accent-red pl-2">{repo.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-auto pt-2">
                        {repo.language ? <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-foreground text-surface rounded-sm">{repo.language}</span> : <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-foreground/10 text-foreground rounded-sm">UNKNOWN</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-8 border-foreground rounded-brutal-sm shadow-[4px_4px_0px_0px_#111111] bg-surface">
          <CardContent className="text-center py-12 flex flex-col items-center">
            <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-foreground bg-surface rounded-brutal-sm mb-6 shadow-[2px_2px_0px_0px_#111111]">
              <GitBranch size={32} className="text-foreground" />
            </div>
            <p className="font-heading font-bold text-2xl uppercase tracking-tight mb-2">Access_User_Repositories</p>
            <p className="font-mono text-sm text-muted mb-8 border-l-2 border-accent-red pl-4">Require GitHub authentication to map private/user-owned sources.</p>
            <Link href="/login?next=/connect">
              <Button variant="outline" className="gap-2 cursor-pointer font-bold uppercase tracking-widest text-xs h-12">
                <GitBranch size={16} />
                Authorize_Connection
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
          <CardDescription>Drag and drop files or a project folder</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Hidden folder input */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error -- webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            onChange={(e) => { handleUploadFiles(e.target.files); e.target.value = ""; }}
            className="hidden"
          />

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative p-10 text-center border-2 border-dashed rounded-xl transition-all cursor-pointer ${dragOver
              ? "border-primary bg-primary/5"
              : "border-foreground/20 hover:border-foreground/40 hover:bg-surface/50"
              }`}
          >
            <input
              type="file"
              multiple
              onChange={(e) => { handleUploadFiles(e.target.files); e.target.value = ""; }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.html,.css,.json,.yaml,.yml,.md,.sql,.sh"
            />
            <div className="inline-flex items-center justify-center w-14 h-14 bg-foreground/5 rounded-2xl mb-4">
              <Upload size={28} className="text-muted" />
            </div>
            <p className="font-bold mb-1">
              Drop files or a folder here, or click to browse files
            </p>
            <p className="text-xs text-muted font-medium">
              .ts, .tsx, .js, .py, .go, .java, .html, .css, .json, and more
            </p>
          </div>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold border-2 border-foreground/15 rounded-xl hover:border-foreground/30 hover:bg-surface/50 transition-all cursor-pointer"
          >
            <FolderOpen size={16} />
            Select a Folder
          </button>

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
                      <span className="text-xs font-medium truncate" title={path}>{path}</span>
                      <Badge variant="default" className="text-[10px] shrink-0">{(file.size / 1024).toFixed(1)} KB</Badge>
                    </div>
                    <button onClick={() => removeUploadFile(i)} className="cursor-pointer p-1.5 hover:bg-primary/10 rounded-lg transition-colors shrink-0">
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
