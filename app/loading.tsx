import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex p-4 bg-surface border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] animate-pulse-brutal">
          <Loader2 size={32} className="animate-spin" />
        </div>
        <p className="mt-4 font-bold text-muted">Loading...</p>
      </div>
    </div>
  );
}
