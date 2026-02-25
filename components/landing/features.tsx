"use client";

import { useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { MousePointer2 } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

// --- Card 1: Diagnostic Shuffler ---
// Value Prop: "Identify Tech Stack"
function DiagnosticShuffler() {
  const [cards, setCards] = useState([
    { id: 1, label: "FRAMEWORK_DETECT: NEXT.JS" },
    { id: 2, label: "ROUTING_LAYER: APP ROUTER" },
    { id: 3, label: "DATABASE_NODE: SUPABASE" },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCards((prev) => {
        const newCards = [...prev];
        const last = newCards.pop();
        if (last) newCards.unshift(last);
        return newCards;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface border-2 border-foreground rounded-brutal shadow-brutal-lg p-6 flex flex-col h-full brutal-hover">
      <h3 className="text-xl font-heading font-bold mb-2 uppercase">Tech_Stack_Shuffler</h3>
      <p className="text-sm font-mono text-muted mb-8 border-l-2 border-accent-red pl-3">
        Identify every language, framework, database automatically.
      </p>
      <div className="relative h-48 w-full mt-auto flex items-center justify-center">
        {cards.map((card, index) => {
          // Calculate inline styles based on index (0 is top)
          const isTop = index === 0;
          return (
            <div
              key={card.id}
              className="absolute w-[85%] p-4 border-2 border-foreground bg-surface rounded-brutal-sm transition-all duration-500 flex items-center justify-center"
              style={{
                transform: `translateY(${index * 12}px) scale(${1 - index * 0.05})`,
                zIndex: 10 - index,
                opacity: 1 - index * 0.2,
                boxShadow: index === 0 ? "4px 4px 0px 0px #E63B2E" : "none",
                borderColor: index === 0 ? "#E63B2E" : "#111111",
                transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)"
              }}
            >
              <span className={`font-mono text-xs font-bold ${isTop ? "text-accent-red" : "text-foreground"}`}>
                {card.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Card 2: Telemetry Typewriter ---
// Value Prop: "Map Architecture"
function TelemetryTypewriter() {
  const fullText = `> INITIATING ARCHITECTURE SCAN...
> DETECTING ENTRY POINTS... [OK]
> MAPPING DATA FLOW...      [OK]
> DEPENDENCY GRAPH:         GENERATED.
> SYSTEM STATUS:            UNDERSTOOD.`;

  const [text, setText] = useState("");
  const typewriterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setText(fullText.substring(0, i));
      i++;
      if (i > fullText.length) {
        clearInterval(interval);
        setTimeout(() => { i = 0; }, 5000); // Reset after 5s
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-surface border-2 border-foreground rounded-brutal shadow-brutal-lg p-6 flex flex-col h-full brutal-hover">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-heading font-bold uppercase">Architecture_Telemetry</h3>
        <div className="flex items-center gap-2 px-2 py-0.5 border border-foreground rounded-full">
          <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse-brutal" />
          <span className="text-[10px] font-mono font-bold">LIVE FEED</span>
        </div>
      </div>
      <p className="text-sm font-mono text-muted mb-6 border-l-2 border-accent-red pl-3">
        Understand how your code is organized from entry points to data flow.
      </p>
      <div
        ref={typewriterRef}
        className="mt-auto bg-foreground text-surface p-4 rounded-brutal-sm border border-foreground min-h-[160px] font-mono text-xs leading-relaxed"
      >
        <span className="whitespace-pre-wrap">{text}</span>
        <span className="inline-block w-2 bg-accent-red h-3 ml-1 animate-blink align-middle" />
      </div>
    </div>
  );
}

// --- Card 3: Cursor Protocol Scheduler ---
// Value Prop: "Personalized Learning Path"
function CursorProtocolScheduler() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const days = ["S", "M", "T", "W", "T", "F", "S"];
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useGSAP(() => {
    if (!cursorRef.current || !containerRef.current) return;

    // Only animate when visible in viewport
    const tl = gsap.timeline({
      repeat: -1,
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top 80%",
      }
    });

    // Reset
    tl.set(cursorRef.current, { x: 180, y: 120, opacity: 0, scale: 1 });
    tl.call(() => setActiveDay(null));

    // Enter
    tl.to(cursorRef.current, { opacity: 1, duration: 0.3 });

    // Move to Tuesday (index 2)
    tl.to(cursorRef.current, { x: 80, y: 25, duration: 1, ease: "power2.inOut" });

    // Click!
    tl.to(cursorRef.current, { scale: 0.9, duration: 0.1 });
    tl.call(() => setActiveDay(2));
    tl.to(cursorRef.current, { scale: 1, duration: 0.1 });
    tl.to(cursorRef.current, { x: 85, y: 30, duration: 0.2 }); // slight rebound

    // Move to Save
    tl.to(cursorRef.current, { x: 140, y: 80, duration: 0.8, ease: "power2.inOut", delay: 0.3 });

    // Click Save
    tl.to(cursorRef.current, { scale: 0.9, duration: 0.1 });
    tl.to(".save-btn-target", { backgroundColor: "#B3281E", duration: 0.1 }, "<");
    tl.to(".save-btn-target", { backgroundColor: "#E63B2E", duration: 0.2 }, ">");
    tl.to(cursorRef.current, { scale: 1, duration: 0.1 });

    // Exit
    tl.to(cursorRef.current, { x: 200, y: 150, opacity: 0, duration: 0.8, ease: "power2.in" });

  }, { scope: containerRef });

  return (
    <div
      ref={containerRef}
      className="bg-surface border-2 border-foreground rounded-brutal shadow-brutal-lg p-6 flex flex-col h-full brutal-hover overflow-hidden relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <h3 className="text-xl font-heading font-bold mb-2 uppercase">Path_Scheduler</h3>
      <p className="text-sm font-mono text-muted mb-8 border-l-2 border-accent-red pl-3">
        Step-by-step tutorials, generated specifically for your codebase.
      </p>

      <div className="mt-auto relative w-full aspect-[2/1] border-2 border-foreground/20 rounded-brutal-sm p-4 bg-background">
        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => (
            <div
              key={i}
              className={`aspect-square flex items-center justify-center border border-foreground/30 font-mono text-[10px] font-bold rounded-sm transition-colors duration-200
                ${activeDay === i ? 'bg-accent-red text-surface border-accent-red' : 'bg-surface'}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Mock Save Button */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          <div className="save-btn-target px-4 py-1.5 bg-accent-red border border-foreground text-surface text-[10px] font-mono font-bold rounded-sm shadow-[2px_2px_0px_0px_#111111]">
            COMMIT_PATH
          </div>
        </div>

        {/* Animated Cursor */}
        <div
          ref={cursorRef}
          className="absolute top-0 left-0 z-10 drop-shadow-md text-foreground pointer-events-none"
          style={{ width: '24px', height: '24px' }}
        >
          <MousePointer2 fill="#FFFFFF" size={24} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

// --- Main Section ---
export function Features() {
  const sectionRef = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!sectionRef.current) return;

    gsap.fromTo(
      ".feature-card-wrapper",
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        stagger: 0.15,
        duration: 0.8,
        ease: "power3.out",
        scrollTrigger: {
          trigger: sectionRef.current,
          start: "top 75%",
        }
      }
    );
  }, { scope: sectionRef });

  return (
    <section ref={sectionRef} className="relative py-32 bg-background border-y-2 border-foreground z-20">
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="mb-16 border-b-2 border-foreground/20 pb-8 flex flex-col md:flex-row justify-between items-end gap-6">
          <div className="max-w-2xl">
            <h2 className="text-sm font-mono font-bold text-accent-red mb-2">[ LAYER_01_ANALYSIS ]</h2>
            <h3 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold uppercase tracking-tight">
              Interactive Functional Artifacts.
            </h3>
          </div>
          <p className="text-base font-mono text-muted max-w-sm">
            Not marketing widgets. Real-time diagnostic overlays applied directly to your codebase topology.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="feature-card-wrapper h-[400px]">
            <DiagnosticShuffler />
          </div>
          <div className="feature-card-wrapper h-[400px]">
            <TelemetryTypewriter />
          </div>
          <div className="feature-card-wrapper h-[400px]">
            <CursorProtocolScheduler />
          </div>
        </div>
      </div>
    </section>
  );
}
