"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
    {
        id: "01",
        title: "ESTABLISH CONNECTION",
        desc: "Link repository source. Ingest codebase artifacts. Prepare topological mapping.",
        type: "geometric"
    },
    {
        id: "02",
        title: "EXECUTE ANALYSIS",
        desc: "Run diagnostic overlays. Identify architecture patterns. Detect functional systems.",
        type: "scanner"
    },
    {
        id: "03",
        title: "REBUILD COMPREHENSION",
        desc: "Generate personalized learning protocols based on raw repository structures.",
        type: "waveform"
    }
];

export function Protocol() {
    const containerRef = useRef<HTMLElement>(null);

    useGSAP(() => {
        if (!containerRef.current) return;

        const cards = gsap.utils.toArray<HTMLElement>('.protocol-card');

        // Pin container
        ScrollTrigger.create({
            trigger: containerRef.current,
            start: "top top",
            end: `+=${cards.length * 100}%`,
            pin: true,
            anticipatePin: 1,
        });

        cards.forEach((card, i) => {
            // Don't animate the first card entirely in
            if (i > 0) {
                gsap.fromTo(card,
                    { y: () => window.innerHeight },
                    {
                        y: 0,
                        ease: "none",
                        scrollTrigger: {
                            trigger: containerRef.current,
                            start: `top+=${(i - 1) * 100}% top`,
                            end: `top+=${i * 100}% top`,
                            scrub: true,
                        }
                    }
                );
            }

            // Animate previous cards out (scale down, blur, fade)
            if (i < cards.length - 1) {
                gsap.to(card, {
                    scale: 0.9,
                    opacity: 0.5,
                    filter: "blur(5px)", // Brutalist Signal preset dictates up to 20px, but 5px is cleaner here
                    ease: "none",
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: `top+=${i * 100}% top`,
                        end: `top+=${(i + 1) * 100}% top`,
                        scrub: true,
                    }
                });
            }
        });

    }, { scope: containerRef });

    return (
        <section ref={containerRef} className="relative h-screen bg-background overflow-hidden border-b border-foreground">
            {steps.map((step, i) => (
                <div
                    key={step.id}
                    className="protocol-card absolute top-0 left-0 w-full h-full flex items-center justify-center p-4 sm:p-8"
                    style={{ zIndex: i + 10 }}
                >
                    {/* Card Container */}
                    <div className="w-full max-w-5xl aspect-[4/3] md:aspect-[21/9] bg-surface border-2 border-foreground shadow-brutal-xl rounded-brutal flex flex-col md:flex-row overflow-hidden brutal-hover">

                        {/* Visualizer Side (Left) */}
                        <div className="w-full md:w-1/2 h-48 md:h-full border-b-2 md:border-b-0 md:border-r-2 border-foreground bg-background relative flex items-center justify-center">
                            <div className="absolute top-4 left-4 font-mono text-xs font-bold text-accent-red">VISUALIZER_{step.id}</div>

                            {/* Conditional Canvas/SVG based on step type */}
                            {step.type === 'geometric' && (
                                <svg className="w-32 h-32 md:w-48 md:h-48 animate-spin" style={{ animationDuration: '20s' }} viewBox="0 0 100 100">
                                    <path d="M50 5 L95 27.5 L95 72.5 L50 95 L5 72.5 L5 27.5 Z" fill="none" stroke="#111111" strokeWidth="2" />
                                    <path d="M50 15 L86.6 33.7 L86.6 66.3 L50 85 L13.4 66.3 L13.4 33.7 Z" fill="none" stroke="#E63B2E" strokeWidth="2" strokeDasharray="4 4" />
                                    <circle cx="50" cy="50" r="10" fill="#111111" />
                                </svg>
                            )}

                            {step.type === 'scanner' && (
                                <div className="w-48 h-48 border border-foreground/30 relative overflow-hidden bg-[linear-gradient(rgba(17,17,17,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(17,17,17,0.1)_1px,transparent_1px)] bg-[size:16px_16px]">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-accent-red animate-slide-up shadow-[0_0_10px_0_#E63B2E]" style={{ animationDirection: 'alternate', animationIterationCount: 'infinite', animationDuration: '2s' }} />
                                </div>
                            )}

                            {step.type === 'waveform' && (
                                <svg className="w-full h-32 px-4" viewBox="0 0 400 100" preserveAspectRatio="none">
                                    <path
                                        d="M 0 50 Q 50 50 50 10 Q 75 90 100 50 T 200 50 T 300 50 Q 325 10 350 90 Q 375 50 400 50"
                                        fill="none"
                                        stroke="#E63B2E"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        className="animate-pulse-brutal"
                                        style={{ strokeDasharray: 1000, strokeDashoffset: 1000, animation: 'dashoffset 3s linear infinite' }}
                                    />
                                    <style>{`
                    @keyframes dashoffset {
                      to { stroke-dashoffset: 0; }
                    }
                  `}</style>
                                </svg>
                            )}

                        </div>

                        {/* Content Side (Right) */}
                        <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                            <h4 className="font-mono text-4xl md:text-6xl font-bold text-foreground/20 mb-2">{step.id}</h4>
                            <h3 className="font-heading text-2xl md:text-4xl font-bold uppercase mb-4">{step.title}</h3>
                            <p className="font-mono text-sm md:text-base text-muted leading-relaxed border-l-2 border-accent-red pl-4">
                                {step.desc}
                            </p>
                        </div>

                    </div>
                </div>
            ))}
        </section>
    );
}
