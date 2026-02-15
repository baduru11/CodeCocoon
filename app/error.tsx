"use client";

import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="inline-flex p-4 bg-primary/10 border-3 border-primary rounded-[4px] shadow-[5px_5px_0px_0px_#FF6B6B] mb-6">
          <AlertTriangle size={32} className="text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Something went wrong!</h1>
        <p className="text-muted font-medium mb-6">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <Button onClick={reset} className="gap-2">
          <RotateCcw size={16} />
          Try Again
        </Button>
      </div>
    </div>
  );
}
