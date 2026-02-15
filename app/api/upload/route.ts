import { NextResponse } from "next/server";
import type { RepoFile } from "@/types/github";
import { getLanguageFromExtension, getFileExtension } from "@/lib/utils";
import { BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files: RepoFile[] = [];
    const languages: Record<string, number> = {};
    let totalSize = 0;

    const entries = formData.getAll("files");

    for (const entry of entries) {
      if (!(entry instanceof File)) continue;

      const ext = getFileExtension(entry.name);

      // Skip binary files
      if (BINARY_EXTENSIONS.has(ext)) continue;

      // Skip files that are too large
      if (entry.size > MAX_FILE_SIZE_BYTES) continue;

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
