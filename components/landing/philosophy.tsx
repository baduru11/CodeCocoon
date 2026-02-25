"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function Philosophy() {
    const sectionRef = useRef<HTMLElement>(null);
    const textRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        if (!sectionRef.current || !textRef.current) return;

        // Split text into spans for word-by-word reveal
        const dramaText = textRef.current.querySelector('.drama-text');
        if (dramaText && dramaText.textContent) {
            const words = dramaText.textContent.split(' ');
            dramaText.innerHTML = '';
            words.forEach(word => {
                const span = document.createElement('span');
                span.textContent = word + ' ';
                span.className = 'inline-block opacity-10 translate-y-4 transition-transform';
                dramaText.appendChild(span);
            });

            // Scrub animation based on ScrollTrigger
            gsap.to(dramaText.children, {
                opacity: 1,
                y: 0,
                stagger: 0.1,
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top 60%",
                    end: "center center",
                    scrub: 1,
                }
            });
        }
    }, { scope: sectionRef });

    return (
        <section
            ref={sectionRef}
            className="relative min-h-[80vh] flex items-center py-24 md:py-32 bg-[#0A0A0A] text-surface overflow-hidden"
        >
            {/* Parallaxing organic texture image behind text */}
            <div
                className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1518002171953-a080ee817e1f?q=80&w=2940&auto=format&fit=crop')] bg-cover bg-center opacity-10 mix-blend-overlay"
                style={{ backgroundAttachment: 'fixed' }} // Parallax effect
            />

            {/* Grid overlay */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full">
                <div ref={textRef} className="max-w-5xl mx-auto flex flex-col gap-8 md:gap-16">

                    <div className="self-start">
                        <h2 className="text-sm md:text-base font-mono font-bold text-surface/50 mb-4 tracking-widest">[ MANIFESTO_01 ]</h2>
                        <p className="text-xl md:text-3xl font-heading font-medium text-surface/70 leading-relaxed max-w-2xl border-l-4 border-surface/20 pl-6">
                            Most developer tools focus on blindly generation: producing lines of code you ultimately cannot maintain.
                        </p>
                    </div>

                    <div className="self-end text-right md:text-left md:self-start w-full mt-8 md:mt-24">
                        <p className="text-sm md:text-base font-mono font-bold text-accent-red mb-4 tracking-widest">[ MANIFESTO_02 ]</p>
                        <p className="drama-text text-5xl md:text-7xl lg:text-8xl font-drama italic leading-[1.1] text-surface">
                            We focus on architectural comprehension. Because generated code is useless until it is <span className="text-accent-red not-italic font-heading uppercase font-bold text-[0.8em]">Understood</span>.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
}
