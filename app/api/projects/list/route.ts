import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProjects } from "@/lib/supabase/db";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const projects = await getUserProjects(supabase);

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to list projects:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
