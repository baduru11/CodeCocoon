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

    const rawProjects = await getUserProjects(supabase);

    // Transform DB rows into the shape the dashboard expects
    const projects = rawProjects.map((p) => {
      const analysis = p.analysis_results?.[0];
      const techStack = analysis?.tech_stack as {
        languages?: string[];
        frameworks?: string[];
        databases?: string[];
        tools?: string[];
        styling?: string[];
      } | null;

      // Combine all tech categories into a flat list
      const allTech = [
        ...(techStack?.frameworks ?? []),
        ...(techStack?.languages ?? []),
        ...(techStack?.databases ?? []),
        ...(techStack?.tools ?? []),
        ...(techStack?.styling ?? []),
      ];

      return {
        id: p.id,
        repoName: p.name,
        date: p.created_at,
        techStack: allTech,
        fileCount: p.file_count,
        status: p.status,
        githubUrl: p.github_url,
      };
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Failed to list projects:", error);
    const message =
      error instanceof Error ? error.message : "Failed to list projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
