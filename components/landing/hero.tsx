import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Github, ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
  return (
    <section className="relative py-24 md:py-36 overflow-hidden">
      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-40" />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background/80 to-background" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Badge */}
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-sm font-bold bg-accent-yellow border-2 border-foreground rounded-lg shadow-[3px_3px_0px_0px_#1E293B] animate-fade-in"
          style={{ "--delay": "0ms" } as React.CSSProperties}
        >
          <Sparkles size={14} />
          From vibe coder to real developer
        </div>

        {/* Headline */}
        <h1
          className="text-5xl md:text-7xl font-bold leading-[1.08] tracking-tight mb-6 animate-fade-in"
          style={{ "--delay": "100ms" } as React.CSSProperties}
        >
          <span className="relative inline-block">
            <span className="relative z-10">Unwrap</span>
            <span className="absolute bottom-1 left-0 w-full h-5 bg-accent-yellow/80 -z-0 -rotate-1 rounded-sm" />
          </span>{" "}
          Your{" "}
          <span className="text-primary">AI-Generated</span>{" "}
          Code
        </h1>

        {/* Subtext */}
        <p
          className="text-lg md:text-xl font-medium text-muted max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in"
          style={{ "--delay": "200ms" } as React.CSSProperties}
        >
          Your AI-generated code is like a cocoon — there&apos;s something powerful inside, but
          it&apos;s all wrapped up. CodeCocoon analyzes your codebase and creates{" "}
          <span className="font-bold text-foreground">personalized learning paths</span> built from your own code.
        </p>

        {/* CTA Buttons */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
          style={{ "--delay": "300ms" } as React.CSSProperties}
        >
          <Link href="/connect">
            <Button size="lg" className="gap-2 text-lg" aria-label="Connect your GitHub repository">
              <Github size={20} />
              Connect GitHub
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Link href="/connect">
            <Button variant="outline" size="lg" className="gap-2 text-lg" aria-label="Paste a repository URL">
              Paste Repo URL
            </Button>
          </Link>
        </div>

        {/* Terminal Mockup */}
        <div
          className="mt-14 max-w-lg mx-auto animate-fade-in"
          style={{ "--delay": "500ms" } as React.CSSProperties}
        >
          <div className="bg-foreground border-2 border-foreground rounded-xl shadow-[6px_6px_0px_0px_#1E293B] overflow-hidden text-left">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b-2 border-surface/10">
              <div className="w-3 h-3 rounded-full bg-accent-pink" />
              <div className="w-3 h-3 rounded-full bg-accent-yellow" />
              <div className="w-3 h-3 rounded-full bg-accent-green" />
              <span className="text-xs font-mono text-surface/40 ml-2">codecocoon ~ analyze</span>
            </div>
            <div className="px-4 py-4 font-mono text-sm text-surface/80 space-y-1.5">
              <p><span className="text-accent-green font-bold">$</span> Analyzing repository...</p>
              <p className="text-accent-yellow">  Detecting tech stack: Next.js, TypeScript, Tailwind</p>
              <p className="text-accent-purple">  Mapping architecture: App Router, 12 routes</p>
              <p className="text-accent-green">  Generating learning path...</p>
              <p className="text-surface/40">  Building exercises from your code<span className="animate-blink">_</span></p>
            </div>
          </div>
        </div>

        {/* Social proof */}
        <p
          className="mt-8 text-sm font-medium text-muted animate-fade-in"
          style={{ "--delay": "600ms" } as React.CSSProperties}
        >
          No sign-up required — works with any public GitHub repository
        </p>
      </div>
    </section>
  );
}
