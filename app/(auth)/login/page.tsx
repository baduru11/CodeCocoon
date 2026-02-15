"use client";

import { createClient } from "@/lib/supabase/client";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Github, ArrowLeft } from "lucide-react";
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
        scopes: "repo read:user",
      },
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface border-3 border-foreground rounded-[4px] shadow-[8px_8px_0px_0px_#1A1A1A] p-8">
          <h1 className="text-3xl font-bold mb-2">Sign In</h1>
          <p className="text-muted font-medium mb-8">
            Connect your GitHub account to browse your repositories and track your progress.
          </p>

          {error && (
            <div className="mb-6 p-3 bg-red-100 border-3 border-red-500 rounded-[4px] text-sm font-bold text-red-700">
              Authentication failed. Please try again.
            </div>
          )}

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-foreground text-surface font-bold text-lg border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
          >
            <Github size={22} />
            Continue with GitHub
          </button>

          <div className="mt-6 text-center">
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
