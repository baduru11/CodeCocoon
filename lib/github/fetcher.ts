import { Octokit } from "octokit";
import pLimit from "p-limit";
import type {
  RepoFile,
  FetchRepoResult,
  FetchTreeResult,
  TreePreviewFile,
  GitHubTree,
} from "@/types/github";
import { filterSourceFiles, getLanguageStats } from "./filter";
import { getLanguageFromExtension, getFileExtension } from "@/lib/utils";
import {
  MAX_FILES_TO_FETCH,
  MAX_TOTAL_CONTENT_BYTES,
  GITHUB_BATCH_CONCURRENCY,
} from "@/lib/constants";

interface FetchOptions {
  token?: string;
  branch?: string;
  maxFiles?: number;
}

/**
 * Fetch repository file tree and contents.
 */
export async function fetchRepoFiles(
  owner: string,
  repo: string,
  options: FetchOptions = {}
): Promise<FetchRepoResult> {
  const token = options.token || process.env.GITHUB_TOKEN || "";
  const octokit = createOctokit(token);

  try {
    return await fetchRepoFilesWithClient(octokit, owner, repo, options);
  } catch (error) {
    // If authenticated request fails with 401/403, retry without auth
    if (token && isAuthError(error)) {
      console.warn(
        `GitHub auth failed (${(error as Error).message}). Retrying without authentication...`
      );
      const anonOctokit = createOctokit("");
      return await fetchRepoFilesWithClient(anonOctokit, owner, repo, options);
    }
    throw error;
  }
}

function createOctokit(token: string): Octokit {
  // Only pass auth if token looks like a real token — passing an invalid
  // token is worse than no token (GitHub returns 401 instead of allowing
  // unauthenticated access at 60 req/hr).
  const cleaned = token.trim();
  const isPlaceholder =
    !cleaned ||
    cleaned.includes("your-") ||
    cleaned.includes("placeholder") ||
    cleaned.includes("example") ||
    cleaned.length < 10;

  return isPlaceholder ? new Octokit() : new Octokit({ auth: cleaned });
}

function isAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  return status === 401 || status === 403;
}

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as { status?: number }).status;
  const message = (error as { message?: string }).message || "";
  return (
    status === 403 && message.toLowerCase().includes("rate limit")
  ) || (
    status === 429
  ) || (
    message.toLowerCase().includes("quota exhausted")
  );
}

async function fetchRepoFilesWithClient(
  octokit: Octokit,
  owner: string,
  repo: string,
  options: FetchOptions
): Promise<FetchRepoResult> {
  // Get default branch if not specified
  const branch = options.branch || await getDefaultBranch(octokit, owner, repo);
  const maxFiles = options.maxFiles || MAX_FILES_TO_FETCH;

  // Fetch file tree
  const tree = await fetchTree(octokit, owner, repo, branch);

  // Filter to source files only
  const sourceFiles = filterSourceFiles(tree.tree);

  // Limit number of files
  const filesToFetch = sourceFiles.slice(0, maxFiles);

  // Batch fetch file contents
  const files = await batchFetchContents(octokit, owner, repo, filesToFetch);

  // Calculate language stats
  const languages = getLanguageStats(
    files.map((f) => ({ path: f.path, size: f.size }))
  );

  return {
    files,
    repoName: `${owner}/${repo}`,
    fileCount: files.length,
    languages,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
  };
}

async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return data.default_branch;
  } catch {
    // Fallback to common defaults
    return "main";
  }
}

async function fetchTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<GitHubTree> {
  try {
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: "true",
    });

    if (data.truncated) {
      console.warn(
        `Repository ${owner}/${repo} has too many files (truncated). Only analyzing partial tree.`
      );
    }

    return data as GitHubTree;
  } catch {
    // Try 'master' if 'main' fails
    if (branch === "main") {
      const { data } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: "master",
        recursive: "true",
      });
      return data as GitHubTree;
    }
    throw new Error(`Failed to fetch file tree for ${owner}/${repo}`);
  }
}

async function batchFetchContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  files: { path: string; sha: string; size?: number }[]
): Promise<RepoFile[]> {
  const limit = pLimit(GITHUB_BATCH_CONCURRENCY);
  let totalBytes = 0;

  const results = await Promise.all(
    files.map((file) =>
      limit(async (): Promise<RepoFile | null> => {
        // Stop if we've exceeded total size limit
        if (totalBytes >= MAX_TOTAL_CONTENT_BYTES) return null;

        try {
          const { data } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: file.sha,
          });

          const content = Buffer.from(data.content, "base64").toString("utf-8");
          const size = Buffer.byteLength(content);
          totalBytes += size;

          const ext = getFileExtension(file.path);

          return {
            path: file.path,
            content,
            language: getLanguageFromExtension(ext),
            size,
          };
        } catch (error) {
          console.warn(`Failed to fetch ${file.path}:`, error);
          return null;
        }
      })
    )
  );

  return results.filter((r): r is RepoFile => r !== null);
}

/**
 * Fetch repository file tree metadata WITHOUT content.
 * Returns file paths, sizes, and language info for preview/selection.
 */
export async function fetchRepoTree(
  owner: string,
  repo: string,
  options: FetchOptions = {}
): Promise<FetchTreeResult> {
  const token = options.token || process.env.GITHUB_TOKEN || "";
  const octokit = createOctokit(token);

  try {
    return await fetchRepoTreeWithClient(octokit, owner, repo, options);
  } catch (error) {
    // If authenticated request fails with 401/403, retry without auth
    if (token && isAuthError(error)) {
      console.warn(
        `GitHub auth failed (${(error as Error).message}). Retrying without authentication...`
      );
      const anonOctokit = createOctokit("");
      return await fetchRepoTreeWithClient(anonOctokit, owner, repo, options);
    }
    throw error;
  }
}

async function fetchRepoTreeWithClient(
  octokit: Octokit,
  owner: string,
  repo: string,
  options: FetchOptions
): Promise<FetchTreeResult> {
  const branch = options.branch || await getDefaultBranch(octokit, owner, repo);
  const maxFiles = options.maxFiles || MAX_FILES_TO_FETCH;

  const tree = await fetchTree(octokit, owner, repo, branch);
  const sourceFiles = filterSourceFiles(tree.tree);
  const limited = sourceFiles.slice(0, maxFiles);

  const files: TreePreviewFile[] = limited.map((item) => {
    const ext = getFileExtension(item.path);
    return {
      path: item.path,
      sha: item.sha,
      size: item.size || 0,
      language: getLanguageFromExtension(ext),
      excluded: false,
    };
  });

  const languages = getLanguageStats(
    files.map((f) => ({ path: f.path, size: f.size }))
  );

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return {
    files,
    repoName: `${owner}/${repo}`,
    owner,
    repo,
    totalFiles: files.length,
    totalSize,
    languages,
  };
}

/**
 * Fetch content for specific selected files.
 * Used after tree preview when user has chosen which files to include.
 */
export async function fetchContentForFiles(
  owner: string,
  repo: string,
  files: { path: string; sha: string; size: number }[],
  options: FetchOptions = {}
): Promise<RepoFile[]> {
  const token = options.token || process.env.GITHUB_TOKEN || "";
  const octokit = createOctokit(token);

  try {
    return await batchFetchContents(octokit, owner, repo, files);
  } catch (error) {
    // If authenticated request fails with 401/403, retry without auth
    if (token && isAuthError(error)) {
      console.warn(
        `GitHub auth failed (${(error as Error).message}). Retrying without authentication...`
      );
      const anonOctokit = createOctokit("");
      return await batchFetchContents(anonOctokit, owner, repo, files);
    }
    throw error;
  }
}
