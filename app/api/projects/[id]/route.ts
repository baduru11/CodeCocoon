import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getProjectWithAllData } from "@/lib/supabase/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const data = await getProjectWithAllData(supabase, id);

    if (!data) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to get project:", error);
    const message =
      error instanceof Error ? error.message : "Failed to get project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // RLS ensures only the owner can delete their own projects.
    // Child rows (files, analysis, exercises, etc.) cascade-delete automatically.
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
