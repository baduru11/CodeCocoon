import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search, Code2 } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex items-center justify-center w-28 h-28 bg-accent-yellow/10 border-2 border-accent-yellow/30 rounded-2xl mb-8 relative">
          <span className="text-5xl font-bold text-accent-yellow">404</span>
          <div className="absolute -top-3 -right-3 p-1.5 bg-surface border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B]">
            <Code2 size={16} strokeWidth={3} />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted font-medium mb-2 text-lg">
          This page doesn&apos;t exist yet.
        </p>
        <p className="text-muted text-sm mb-8">
          It hasn&apos;t emerged from its cocoon — but your code journey continues.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/">
            <Button className="gap-2">
              <Home size={16} />
              Go Home
            </Button>
          </Link>
          <Link href="/connect">
            <Button variant="outline" className="gap-2">
              <Search size={16} />
              Analyze a Repo
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
