"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Github, ArrowLeft, Code2, GitBranch, BookOpen, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

function LoginContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/connect";
  const error = searchParams.get("error");

  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${next}`,
        scopes: "public_repo read:user",
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-accent-yellow/10 border-2 border-accent-yellow/30 rounded-xl">
            <Code2 size={32} strokeWidth={3} />
          </div>
        </div>

        <div className="bg-surface border-2 border-foreground/15 rounded-2xl shadow-lg p-8">
          <h1 className="text-3xl font-bold mb-2 text-center">Sign In</h1>
          <p className="text-muted font-medium mb-8 text-center">
            Connect your GitHub account to unlock the full experience.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600">
              Authentication failed. Please try again.
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-foreground text-surface font-bold text-base border-2 border-foreground rounded-xl shadow-[3px_3px_0px_0px_#1E293B] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all cursor-pointer"
          >
            <Github size={22} />
            Continue with GitHub
          </button>

          {/* Benefits */}
          <div className="mt-8 space-y-3">
            <div className="flex items-center gap-3 text-sm text-muted font-medium">
              <div className="p-1.5 bg-secondary/10 rounded-lg">
                <GitBranch size={14} className="text-secondary" />
              </div>
              Browse and analyze your private repos
            </div>
            <div className="flex items-center gap-3 text-sm text-muted font-medium">
              <div className="p-1.5 bg-primary/10 rounded-lg">
                <BookOpen size={14} className="text-primary" />
              </div>
              Save your progress and learning paths
            </div>
            <div className="flex items-center gap-3 text-sm text-muted font-medium">
              <div className="p-1.5 bg-accent-orange/10 rounded-lg">
                <Bug size={14} className="text-accent-orange" />
              </div>
              Track exercise scores over time
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-foreground/10 text-center">
            <p className="text-sm text-muted font-medium mb-4">
              Don&apos;t want to sign in?
            </p>
            <Link href="/connect">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft size={14} />
                Paste a repo URL instead
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginContent />
    </Suspense>
  );
}
