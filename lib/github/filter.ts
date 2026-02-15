import {
  SOURCE_EXTENSIONS,
  CONFIG_FILES,
  IGNORED_DIRS,
  BINARY_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/constants";
import type { GitHubTreeItem, FilterReason, FilterSummary } from "@/types/github";
import { getFileExtension, bytesToSize } from "@/lib/utils";

interface FilterResult {
  included: GitHubTreeItem[];
  excluded: Array<GitHubTreeItem & {
    filterReason: FilterReason;
    filterDetails: string;
  }>;
  summary: FilterSummary;
}

/**
 * Filter tree items with metadata about what was excluded and why.
 */
export function filterSourceFilesWithMetadata(tree: GitHubTreeItem[]): FilterResult {
  const included: GitHubTreeItem[] = [];
  const excluded: Array<GitHubTreeItem & {
    filterReason: FilterReason;
    filterDetails: string;
  }> = [];

  const reasonCounts: Record<FilterReason, number> = {
    too_large: 0,
    binary_file: 0,
    ignored_directory: 0,
    unsupported_extension: 0,
    non_file: 0,
  };

  for (const item of tree) {
    // Only files (blobs)
    if (item.type !== "blob") {
      excluded.push({
        ...item,
        filterReason: "non_file",
        filterDetails: "Not a file (directory or symlink)",
      });
      reasonCounts.non_file++;
      continue;
    }

    // Check if file is too large
    if (item.size && item.size > MAX_FILE_SIZE_BYTES) {
      excluded.push({
        ...item,
        filterReason: "too_large",
        filterDetails: `${bytesToSize(item.size)} exceeds ${bytesToSize(MAX_FILE_SIZE_BYTES)} limit`,
      });
      reasonCounts.too_large++;
      continue;
    }

    const pathParts = item.path.split("/");
    const fileName = pathParts[pathParts.length - 1];
    const ext = getFileExtension(fileName);

    // Check for ignored directories
    let inIgnoredDir = false;
    for (const part of pathParts) {
      if (IGNORED_DIRS.has(part)) {
        excluded.push({
          ...item,
          filterReason: "ignored_directory",
          filterDetails: `In ignored directory: ${part}`,
        });
        reasonCounts.ignored_directory++;
        inIgnoredDir = true;
        break;
      }
    }
    if (inIgnoredDir) continue;

    // Check for binary files
    if (BINARY_EXTENSIONS.has(ext)) {
      excluded.push({
        ...item,
        filterReason: "binary_file",
        filterDetails: `Binary file type: .${ext}`,
      });
      reasonCounts.binary_file++;
      continue;
    }

    // Include config files by name
    if (CONFIG_FILES.has(fileName) || CONFIG_FILES.has(item.path)) {
      included.push(item);
      continue;
    }

    // Include source files by extension
    if (SOURCE_EXTENSIONS.has(ext)) {
      included.push(item);
      continue;
    }

    // Include Dockerfiles (no extension)
    if (fileName === "Dockerfile" || fileName.startsWith("Dockerfile.")) {
      included.push(item);
      continue;
    }

    // File doesn't match any criteria
    excluded.push({
      ...item,
      filterReason: "unsupported_extension",
      filterDetails: ext ? `Extension .${ext} not recognized` : "No file extension",
    });
    reasonCounts.unsupported_extension++;
  }

  const summary: FilterSummary = {
    totalScanned: tree.length,
    totalIncluded: included.length,
    totalExcluded: excluded.length,
    excludedByReason: reasonCounts,
  };

  return { included, excluded, summary };
}

/**
 * Filter tree items to only relevant source files.
 * Legacy function - prefer filterSourceFilesWithMetadata for new code.
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
