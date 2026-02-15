import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { findDuplicateProject } from "@/lib/supabase/db";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    const { githubOwner, githubRepo } = await request.json();

    if (!githubOwner || !githubRepo) {
      return NextResponse.json(
        { error: "githubOwner and githubRepo are required" },
        { status: 400 }
      );
    }

    const existing = await findDuplicateProject(
      supabase,
      githubOwner,
      githubRepo
    );

    if (existing) {
      return NextResponse.json({
        exists: true,
        project: {
          id: existing.id,
          name: existing.name,
          status: existing.status,
          createdAt: existing.created_at,
        },
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error("Failed to check duplicate:", error);
    return NextResponse.json(
      { error: "Failed to check for duplicate project" },
      { status: 500 }
    );
  }
}
