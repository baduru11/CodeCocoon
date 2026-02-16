"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="inline-flex p-4 bg-red-50 border-2 border-red-200 rounded-xl mb-6">
          <AlertTriangle size={32} className="text-red-500" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Something went wrong!</h1>
        <p className="text-muted font-medium mb-2">
          {error.message || "An unexpected error occurred."}
        </p>
        <p className="text-muted text-sm mb-8">
          Don&apos;t worry — your progress is saved. Try again or head back home.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} className="gap-2">
            <RotateCcw size={16} />
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <Home size={16} />
              Go Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
