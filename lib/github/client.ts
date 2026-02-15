import { Octokit } from "octokit";
import type { GitHubRepo } from "@/types/github";

const MAX_PAGES = 5;
const PER_PAGE = 100;

/**
 * Fetch authenticated user's public repositories (paginated).
 */
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const octokit = new Octokit({ auth: token });

  const allRepos: GitHubRepo[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      sort: "updated",
      per_page: PER_PAGE,
      type: "public",
      page,
    });

    for (const repo of data) {
      allRepos.push({
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        description: repo.description,
        html_url: repo.html_url,
        language: repo.language,
        stargazers_count: repo.stargazers_count,
        updated_at: repo.updated_at || "",
        private: repo.private,
        default_branch: repo.default_branch,
        owner: {
          login: repo.owner.login,
          avatar_url: repo.owner.avatar_url,
        },
      });
    }

    // Stop if we got fewer results than requested (last page)
    if (data.length < PER_PAGE) break;
  }

  return allRepos;
}
