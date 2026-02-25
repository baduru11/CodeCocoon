import { NextResponse } from "next/server";
import type { RepoFile, TreePreviewFile, FetchTreeResult, FilterSummary } from "@/types/github";
import { getLanguageFromExtension, getFileExtension } from "@/lib/utils";
import { BINARY_EXTENSIONS, MAX_FILE_SIZE_BYTES } from "@/lib/constants";

const MAX_UPLOAD_FILES = 200;
const MAX_TOTAL_UPLOAD_BYTES = 10_000_000; // 10MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files: RepoFile[] = [];
    const treeFiles: TreePreviewFile[] = [];
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
      const path = entry.name;

      files.push({ path, content, language, size: entry.size });

      treeFiles.push({
        path,
        sha: "",
        size: entry.size,
        language,
        excluded: false,
      });

      languages[language] = (languages[language] || 0) + 1;
      totalSize += entry.size;
    }

    const filterSummary: FilterSummary = {
      totalScanned: entries.length,
      totalIncluded: files.length,
      totalExcluded: entries.length - files.length,
      excludedByReason: {
        too_large: 0,
        binary_file: 0,
        ignored_directory: 0,
        unsupported_extension: 0,
        non_file: 0,
      },
    };

    // Derive a project name from the common root folder if one exists
    const firstPath = files[0]?.path || "";
    const rootFolder = firstPath.includes("/") ? firstPath.split("/")[0] : "";
    const allShareRoot = rootFolder && files.every((f) => f.path.startsWith(rootFolder + "/"));
    const repoName = allShareRoot ? rootFolder : "Uploaded Project";

    const treeData: FetchTreeResult = {
      files: treeFiles,
      excludedFiles: [],
      repoName,
      owner: "_upload",
      repo: repoName,
      totalFiles: treeFiles.length,
      totalExcludedFiles: 0,
      totalSize: totalSize,
      languages,
      filterSummary,
    };

    return NextResponse.json({
      treeData,
      fileContents: files,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process uploaded files" },
      { status: 500 }
    );
  }
}
