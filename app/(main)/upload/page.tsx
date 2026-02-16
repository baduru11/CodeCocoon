"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Upload, FileCode, X, ArrowRight, Loader2 } from "lucide-react";
import type { FetchRepoResult } from "@/types/github";

export default function UploadPage() {
  const router = useRouter();
  const { setValue: setProjectData } = useLocalStorage<FetchRepoResult | null>("projectData", null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);
    setFiles((prev) => [...prev, ...fileArray]);
    setError("");
  }, []);

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
      files.forEach((file) => formData.append("files", file));

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
      router.push("/analyze");
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
          Drag and drop your project files for analysis
        </p>
      </div>

      <Card className="mb-6">
        <CardContent className="p-0">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`relative p-12 text-center border-2 border-dashed rounded-xl m-1 transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-foreground/20 hover:border-foreground/40"
            }`}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".ts,.tsx,.js,.jsx,.py,.rb,.go,.rs,.java,.html,.css,.json,.yaml,.yml,.md,.sql,.sh"
            />
            <Upload size={40} className="mx-auto mb-4 text-muted" />
            <p className="font-bold text-lg mb-1">
              Drop files here or click to browse
            </p>
            <p className="text-sm text-muted font-medium">
              Supports .ts, .tsx, .js, .py, .go, .java, .html, .css, .json, and more
            </p>
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
              {files.map((file, i) => (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between p-2 bg-background rounded-xl border border-foreground/15"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode size={14} className="shrink-0" />
                    <span className="text-sm font-medium truncate">{file.name}</span>
                    <Badge variant="default">{(file.size / 1024).toFixed(1)} KB</Badge>
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
        <p className="mb-4 text-sm font-bold text-red-500 text-center">{error}</p>
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
