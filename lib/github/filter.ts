import {
  SOURCE_EXTENSIONS,
  CONFIG_FILES,
  IGNORED_DIRS,
  BINARY_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/constants";
import type { GitHubTreeItem } from "@/types/github";
import { getFileExtension } from "@/lib/utils";

/**
 * Filter tree items to only relevant source files.
 */
export function filterSourceFiles(tree: GitHubTreeItem[]): GitHubTreeItem[] {
  return tree.filter((item) => {
    // Only files (blobs)
    if (item.type !== "blob") return false;

    // Skip files that are too large
    if (item.size && item.size > MAX_FILE_SIZE_BYTES) return false;

    const pathParts = item.path.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const ext = getFileExtension(fileName);

    // Skip files in ignored directories
    for (const part of pathParts) {
      if (IGNORED_DIRS.has(part)) return false;
    }

    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) return false;

    // Include config files by name
    if (CONFIG_FILES.has(fileName)) return true;
    if (CONFIG_FILES.has(item.path)) return true;

    // Include source files by extension
    if (SOURCE_EXTENSIONS.has(ext)) return true;

    // Include Dockerfiles (no extension)
    if (fileName === "Dockerfile" || fileName.startsWith("Dockerfile.")) {
      return true;
    }

    return false;
  });
}

/**
 * Get language stats from file list.
 */
export function getLanguageStats(
  files: { path: string; size: number }[]
): Record<string, number> {
  const stats: Record<string, number> = {};

  for (const file of files) {
    const ext = getFileExtension(file.path);
    const lang = extToLanguage(ext);
    stats[lang] = (stats[lang] || 0) + 1;
  }

  return stats;
}

function extToLanguage(ext: string): string {
  const map: Record<string, string> = {
    ts: "TypeScript",
    tsx: "TypeScript",
    js: "JavaScript",
    jsx: "JavaScript",
    py: "Python",
    rb: "Ruby",
    go: "Go",
    rs: "Rust",
    java: "Java",
    kt: "Kotlin",
    swift: "Swift",
    cs: "C#",
    cpp: "C++",
    c: "C",
    php: "PHP",
    html: "HTML",
    css: "CSS",
    scss: "CSS",
    json: "JSON",
    yaml: "YAML",
    yml: "YAML",
    md: "Markdown",
    vue: "Vue",
    svelte: "Svelte",
    sql: "SQL",
  };
  return map[ext.toLowerCase()] || ext.toUpperCase();
}
