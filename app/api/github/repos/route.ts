import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { fetchUserRepos } from "@/lib/github/client";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();

    // provider_token is only available transiently after OAuth exchange,
    // so fall back to the persisted cookie set during the callback.
    const cookieStore = await cookies();
    const providerToken =
      session?.provider_token ||
      cookieStore.get("gh_provider_token")?.value;

    if (!providerToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please login with GitHub." },
        { status: 401 }
      );
    }

    const repos = await fetchUserRepos(providerToken);
    return NextResponse.json({ repos });
  } catch (error) {
    console.error("Failed to fetch repos:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
