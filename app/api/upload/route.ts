import { NextResponse } from "next/server";
import type { RepoFile } from "@/types/github";
import { getLanguageFromExtension, getFileExtension } from "@/lib/utils";
import { BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

const MAX_UPLOAD_FILES = 200;
const MAX_TOTAL_UPLOAD_BYTES = 10_000_000; // 10MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files: RepoFile[] = [];
    const languages: Record<string, number> = {};
    let totalSize = 0;

    const entries = formData.getAll("files");

    if (entries.length > MAX_UPLOAD_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_UPLOAD_FILES} allowed.` },
        { status: 400 }
      );
    }

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;

      const ext = getFileExtension(entry.name);

      // Skip binary files
      if (BINARY_EXTENSIONS.has(ext)) continue;

      // Skip files that are too large
      if (entry.size > MAX_FILE_SIZE_BYTES) continue;

      // Enforce total upload size limit
      if (totalSize + entry.size > MAX_TOTAL_UPLOAD_BYTES) break;

      const content = await entry.text();
      const language = getLanguageFromExtension(ext);

      // Get relative path from webkitRelativePath or name
      const path = (entry as File & { webkitRelativePath?: string }).webkitRelativePath || entry.name;

      files.push({
        path,
        content,
        language,
        size: entry.size,
      });

      languages[language] = (languages[language] || 0) + 1;
      totalSize += entry.size;
    }

    return NextResponse.json({
      files,
      repoName: "Uploaded Project",
      fileCount: files.length,
      languages,
      totalSize,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process uploaded files" },
      { status: 500 }
    );
  }
}
