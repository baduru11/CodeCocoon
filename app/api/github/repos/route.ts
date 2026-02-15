import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRepos } from "@/lib/github/client";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.provider_token) {
      return NextResponse.json(
        { error: "Not authenticated. Please login with GitHub." },
        { status: 401 }
      );
    }

    const repos = await fetchUserRepos(session.provider_token);
    return NextResponse.json({ repos });
  } catch (error) {
    console.error("Failed to fetch repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
