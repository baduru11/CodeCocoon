"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Github, ArrowRight, ActivitySquare } from "lucide-react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

export function Hero() {
  const containerRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!containerRef.current) return;

    // GSAP staggered fade-up for all text parts and CTA
    const tl = gsap.timeline();

    tl.fromTo(
      ".hero-element",
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.8,
        stagger: 0.08,
        ease: "power3.out",
        delay: 0.2
      }
    );
  }, { scope: containerRef });

  return (
    <section ref={containerRef} className="relative min-h-[100dvh] flex flex-col justify-end pb-24 md:pb-32 overflow-hidden bg-foreground">
      {/* Background Image (Brutalist Architecture) */}
      <div
        className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1517409259253-27eaeb3fb5ca?q=80&w=2938&auto=format&fit=crop')] bg-cover bg-center opacity-60 mix-blend-luminosity"
      />

      {/* Heavy primary-to-black gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-foreground via-foreground/90 to-transparent" />

      {/* Content pushed to bottom-left third */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 relative z-10 grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 flex flex-col items-start pt-32">
          {/* Badge */}
          <div className="hero-element inline-flex items-center gap-2 px-4 py-1.5 mb-8 text-sm font-mono font-bold bg-surface text-foreground border-2 border-foreground rounded-none shadow-[4px_4px_0px_0px_#E63B2E]">
            <ActivitySquare size={16} />
            DIAGNOSTIC PROTOCOL ENGAGED
          </div>

          {/* Headline - Preset C Pattern: "[Direct verb] the" / "[System noun]." */}
          <h1 className="hero-element text-5xl md:text-7xl lg:text-8xl font-bold leading-[1.0] tracking-tight mb-4 text-surface">
            <span className="block font-heading uppercase">Decode the</span>
            <span className="block font-drama italic text-accent-red text-6xl md:text-8xl lg:text-[140px] mt-2 lg:mt-0 leading-none">Codebase.</span>
          </h1>

          {/* Subtext */}
          <p className="hero-element text-lg md:text-xl font-mono text-surface/70 max-w-2xl mt-6 mb-10 leading-relaxed border-l-4 border-accent-red pl-6">
            Input arbitrary AI-generated artifacts. Extract raw architectural truth. Rebuild comprehension block by block.
          </p>

          {/* CTA Buttons */}
          <div className="hero-element flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <Link href="/connect">
              <Button size="lg" className="h-14 px-8 gap-3 text-lg font-mono rounded-none brutal-hover bg-accent-red text-surface border-2 border-transparent hover:bg-accent-red-hover" aria-label="Connect your GitHub repository">
                <Github size={22} />
                INITIALIZE_GITHUB
                <ArrowRight size={20} className="ml-2" />
              </Button>
            </Link>
            <Link href="/connect">
              <span className="text-sm font-mono text-surface/50 hover:text-surface transition-colors cursor-pointer px-4">
                [ OR INPUT DIRECT URL ]
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

