import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  saveProject,
  updateProjectStatus,
  saveProjectFiles,
  saveAnalysisResult,
  saveLearningPath,
  saveExercises,
} from "@/lib/supabase/db";
import type { AnalysisResult } from "@/types/analysis";
import type { LearningPath } from "@/types/learning";
import type { Exercise } from "@/types/exercise";
import type { RepoFile } from "@/types/github";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required to save projects" },
        { status: 401 }
      );
    }

    const {
      repoName,
      githubOwner,
      githubRepo,
      githubUrl,
      files,
      analysis,
      learningPath,
      exercises,
      skillLevel,
    } = (await request.json()) as {
      repoName: string;
      githubOwner: string;
      githubRepo: string;
      githubUrl?: string;
      files: RepoFile[];
      analysis: AnalysisResult;
      learningPath?: LearningPath;
      exercises?: Exercise[];
      skillLevel?: string;
    };

    if (!repoName || !analysis) {
      return NextResponse.json(
        { error: "Missing required fields: repoName, analysis" },
        { status: 400 }
      );
    }

    // Create project
    const projectId = await saveProject(supabase, {
      user_id: user.id,
      name: repoName,
      source_type: "github",
      github_url: githubUrl || `https://github.com/${githubOwner}/${githubRepo}`,
      github_owner: githubOwner,
      github_repo: githubRepo,
    });

    // Save files (skip content to save DB space — just metadata)
    if (files && files.length > 0) {
      await saveProjectFiles(supabase, projectId, files);
    }

    // Save analysis
    await saveAnalysisResult(supabase, projectId, analysis);

    // Save learning path
    if (learningPath) {
      await saveLearningPath(
        supabase,
        projectId,
        skillLevel || "beginner",
        learningPath
      );
    }

    // Save exercises
    if (exercises && exercises.length > 0) {
      await saveExercises(supabase, projectId, exercises);
    }

    // Mark project as complete
    await updateProjectStatus(supabase, projectId, "complete");

    return NextResponse.json({ projectId, success: true });
  } catch (error) {
    console.error("Failed to save project:", error);
    const message =
      error instanceof Error ? error.message : "Failed to save project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
