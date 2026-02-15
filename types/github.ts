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
}

export interface FetchTreeResult {
  files: TreePreviewFile[];
  repoName: string;
  owner: string;
  repo: string;
  totalFiles: number;
  totalSize: number;
  languages: Record<string, number>;
}

export interface ProcessConfig {
  owner: string;
  repo: string;
  selectedFiles: TreePreviewFile[];
  skillLevel: "beginner" | "intermediate" | "advanced";
  repoName: string;
}
