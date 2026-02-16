import { Code2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <div className="inline-flex p-4 bg-accent-yellow/10 border-2 border-accent-yellow/30 rounded-xl animate-pulse-brutal">
          <Code2 size={32} strokeWidth={3} className="text-foreground" />
        </div>
        <p className="mt-4 font-bold text-muted text-sm">Loading...</p>
      </div>
    </div>
  );
}
