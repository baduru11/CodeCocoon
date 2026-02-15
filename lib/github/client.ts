import { Octokit } from "octokit";
import type { GitHubRepo } from "@/types/github";

/**
 * Fetch authenticated user's repositories.
 */
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  const octokit = new Octokit({ auth: token });

  const { data } = await octokit.rest.repos.listForAuthenticatedUser({
    sort: "updated",
    per_page: 30,
    type: "all",
  });

  return data.map((repo) => ({
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
  }));
}
