import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-24 h-24 bg-accent-yellow border-3 border-foreground rounded-[4px] shadow-[8px_8px_0px_0px_#1A1A1A] mb-6">
          <span className="text-5xl font-bold">404</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">Page Not Found</h1>
        <p className="text-muted font-medium mb-8">
          This page doesn&apos;t exist — it hasn&apos;t emerged from its cocoon yet
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
