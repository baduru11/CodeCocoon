import { NextResponse } from "next/server";
import { parseGitHubUrl } from "@/lib/github/parser";
import { fetchRepoFiles, isRateLimitError } from "@/lib/github/fetcher";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { url, owner, repo } = await request.json();

    let repoOwner = owner;
    let repoName = repo;

    // Parse URL if provided
    if (url) {
      const parsed = parseGitHubUrl(url);
      if (!parsed) {
        return NextResponse.json(
          { error: "Invalid GitHub URL. Try: github.com/owner/repo" },
          { status: 400 }
        );
      }
      repoOwner = parsed.owner;
      repoName = parsed.repo;
    }

    if (!repoOwner || !repoName) {
      return NextResponse.json(
        { error: "Repository owner and name are required" },
        { status: 400 }
      );
    }

    // Try to get auth token for higher rate limits.
    // Only pass a token if Supabase is properly configured AND the user
    // actually has an active session with a valid provider_token.
    let token: string | undefined;
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (supabaseUrl && supabaseKey && !supabaseUrl.includes("placeholder")) {
        const supabase = await createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.provider_token && session.provider_token.trim()) {
          token = session.provider_token;
        }
      }
    } catch {
      // Anonymous access — fine, fetcher.ts will use unauthenticated Octokit
    }

    const result = await fetchRepoFiles(repoOwner, repoName, { token });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch repo:", error);

    if (isRateLimitError(error)) {
      return NextResponse.json(
        {
          error: "GitHub API rate limit exceeded. Unauthenticated requests are limited to 60/hour. Try again later, or log in with GitHub for higher limits (5,000/hour).",
          rateLimited: true,
        },
        { status: 429 }
      );
    }

    const message = error instanceof Error ? error.message : "Failed to fetch repository";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
