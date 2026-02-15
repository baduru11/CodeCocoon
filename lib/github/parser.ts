import type { ParsedGitHubUrl } from "@/types/github";

/**
 * Parse a GitHub URL into owner and repo name.
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/blob/branch/file
 * - github.com/owner/repo
 * - owner/repo (short form)
 */
export function parseGitHubUrl(input: string): ParsedGitHubUrl | null {
  const trimmed = input.trim();

  // Try full URL patterns
  const urlPatterns = [
    /(?:https?:\/\/)?github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  ];

  for (const pattern of urlPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
  }

  // Try short form: owner/repo
  const shortMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  return null;
}

/**
 * Build a GitHub URL from owner and repo.
 */
export function buildGitHubUrl(owner: string, repo: string): string {
  return `https://github.com/${owner}/${repo}`;
}

/**
 * Validate a parsed GitHub URL by checking if the owner/repo look reasonable.
 */
export function isValidGitHubInput(input: string): boolean {
  return parseGitHubUrl(input) !== null;
}

/**
 * Validate that a GitHub owner or repo name matches allowed characters.
 * GitHub allows alphanumeric, hyphens, underscores, and dots.
 */
export function isValidGitHubName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && name.length > 0 && name.length <= 100;
}
