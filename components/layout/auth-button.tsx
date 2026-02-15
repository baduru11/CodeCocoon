"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Github, LayoutDashboard, LogOut } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth]);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/connect`,
        scopes: "public_repo read:user",
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="h-9 w-24 bg-muted/20 border-2 border-foreground/30 rounded-[4px] animate-pulse" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold border-2 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all bg-surface"
        >
          <LayoutDashboard size={14} />
          Dashboard
        </Link>
        <button
          onClick={handleLogout}
          className="p-1.5 border-2 border-foreground rounded-[4px] hover:bg-red-100 transition-colors"
          title="Sign out"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-foreground text-surface border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
    >
      <Github size={16} />
      Login with GitHub
    </button>
  );
}
