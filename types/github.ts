export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
  private: boolean;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
  url: string;
}

export interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

export interface RepoFile {
  path: string;
  content: string;
  language: string;
  size: number;
}

export interface ParsedGitHubUrl {
  owner: string;
  repo: string;
}

// Why a file was filtered
export type FilterReason =
  | "too_large"
  | "binary_file"
  | "ignored_directory"
  | "unsupported_extension"
  | "non_file";

// Summary of filtering for UI display
export interface FilterSummary {
  totalScanned: number;
  totalIncluded: number;
  totalExcluded: number;
  excludedByReason: Record<FilterReason, number>;
}

export interface FetchRepoResult {
  files: RepoFile[];
  repoName: string;
  fileCount: number;
  languages: Record<string, number>;
  totalSize: number;
}

// New types for the configure/preview flow
export interface TreePreviewFile {
  path: string;
  sha: string;
  size: number;
  language: string;
  excluded: boolean;
  filterReason?: FilterReason; // Why this file was filtered (if excluded)
  filterDetails?: string; // Human-readable explanation
}

export interface FetchTreeResult {
  files: TreePreviewFile[];
  excludedFiles: TreePreviewFile[]; // Files that were filtered out
  repoName: string;
  owner: string;
  repo: string;
  totalFiles: number;
  totalExcludedFiles: number; // Count of excluded files
  totalSize: number;
  languages: Record<string, number>;
  filterSummary: FilterSummary; // Summary of filtering
}

export interface ProcessConfig {
  owner: string;
  repo: string;
  selectedFiles: TreePreviewFile[];
  skillLevel: "beginner" | "intermediate" | "advanced";
  repoName: string;
}
