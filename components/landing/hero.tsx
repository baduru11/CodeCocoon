import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Github, ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section className="relative py-20 md:py-32 overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute top-10 left-10 w-20 h-20 bg-accent-yellow border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] rotate-12 hidden lg:block" />
      <div className="absolute top-40 right-20 w-16 h-16 bg-accent-green border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] -rotate-6 hidden lg:block" />
      <div className="absolute bottom-20 left-1/4 w-12 h-12 bg-secondary border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] rotate-45 hidden lg:block" />
      <div className="absolute bottom-40 right-1/3 w-14 h-14 bg-primary border-3 border-foreground rounded-[4px] shadow-[5px_5px_0px_0px_#1A1A1A] -rotate-12 hidden lg:block" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center px-4 py-1.5 mb-8 text-sm font-bold bg-accent-yellow border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A]">
          Transform from vibe coder to real developer
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
          <span className="relative inline-block">
            <span className="relative z-10">Unwrap</span>
            <span className="absolute bottom-1 left-0 w-full h-4 bg-accent-yellow -z-0" />
          </span>{" "}
          Your AI-Generated Code
        </h1>

        {/* Subtext */}
        <p className="text-lg md:text-xl font-medium text-muted max-w-2xl mx-auto mb-10">
          Your AI-generated code is like a cocoon — there&apos;s something powerful inside, but
          it&apos;s all wrapped up. CodeCocoon helps you understand every layer, built from{" "}
          <span className="font-bold text-foreground">your own code</span>.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/connect">
            <Button size="lg" className="gap-2 text-lg">
              <Github size={20} />
              Connect GitHub
              <ArrowRight size={18} />
            </Button>
          </Link>
          <Link href="/connect">
            <Button variant="outline" size="lg" className="gap-2 text-lg">
              Paste Repo URL
            </Button>
          </Link>
        </div>

        {/* Social proof */}
        <p className="mt-8 text-sm font-medium text-muted">
          No sign-up required — paste any public repo URL to get started
        </p>
      </div>
    </section>
  );
}
