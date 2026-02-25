"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Upload, FileCode, X, ArrowRight, Loader2, FolderOpen } from "lucide-react";
import type { FetchRepoResult, FetchTreeResult } from "@/types/github";

interface TrackedFile {
  file: File;
  path: string;
}

/** Recursively read all files from dropped DataTransfer items (handles folders). */
async function readDroppedEntries(
  items: DataTransferItemList
): Promise<TrackedFile[]> {
  const result: TrackedFile[] = [];

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

export default function UploadPage() {
  const router = useRouter();
  const { setValue: setProjectData } = useLocalStorage<FetchRepoResult | null>("projectData", null);
  const { setValue: setTreeData } = useLocalStorage<FetchTreeResult | null>("treeData", null);
  const [files, setFiles] = useState<TrackedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((newFiles: TrackedFile[]) => {
    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
    setError("");
  }, []);

  const handleFileInput = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      addFiles(Array.from(fileList).map((f) => ({ file: f, path: f.name })));
    },
    [addFiles]
  );

  const handleFolderInput = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      addFiles(
        Array.from(fileList).map((f) => ({
          file: f,
          path: f.webkitRelativePath || f.name,
        }))
      );
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);

      if (e.dataTransfer.items?.length) {
        const hasDir = Array.from(e.dataTransfer.items).some(
          (item) => item.webkitGetAsEntry?.()?.isDirectory
        );
        if (hasDir) {
          const entries = await readDroppedEntries(e.dataTransfer.items);
          addFiles(entries);
          return;
        }
      }
      if (e.dataTransfer.files) {
        handleFileInput(e.dataTransfer.files);
      }
    },
    [addFiles, handleFileInput]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError("Please select some files");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      files.forEach(({ file, path }) => formData.append("files", file, path));

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

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
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">Upload Your Code</h1>
        <p className="text-muted font-medium text-lg">
          Drag and drop your project files or folders for analysis
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-0">
          {/* Drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`p-12 text-center border-2 border-dashed rounded-xl m-1 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-foreground/20 hover:border-foreground/40"
            }`}
          >
            {/* Hidden inputs */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => {
                handleFileInput(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
              accept=".ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.html,.css,.json,.yaml,.yml,.md,.sql,.sh"
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is a non-standard attribute not in React types
              webkitdirectory=""
              onChange={(e) => {
                handleFolderInput(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />

            <Upload size={40} className="mx-auto mb-4 text-muted" />
            <p className="font-bold text-lg mb-1">
              Drop files or folders here
            </p>
            <p className="text-sm text-muted font-medium mb-5">
              Supports .ts, .tsx, .js, .py, .go, .java, .html, .css, .json, and
              more
            </p>
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2 cursor-pointer"
              >
                <FileCode size={16} />
                Browse Files
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
                className="gap-2 cursor-pointer"
              >
                <FolderOpen size={16} />
                Browse Folder
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File list */}
      {files.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <FileCode size={18} />
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFiles([])}
                className="text-red-500"
              >
                Clear all
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {files.map(({ file, path }, i) => (
                <div
                  key={`${path}-${i}`}
                  className="flex items-center justify-between p-2 bg-background rounded-xl border border-foreground/15"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode size={14} className="shrink-0" />
                    <span className="text-sm font-medium truncate">
                      {path}
                    </span>
                    <Badge variant="default">
                      {(file.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 hover:bg-red-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <p className="mb-4 text-sm font-bold text-red-500 text-center">
          {error}
        </p>
      )}

      <div className="flex justify-center">
        <Button
          onClick={handleUpload}
          disabled={loading || files.length === 0}
          size="lg"
          className="gap-2"
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <ArrowRight size={18} />
          )}
          Analyze {files.length} File{files.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}
