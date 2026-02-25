"use client";

import Link from "next/link";
import { useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthButton } from "./auth-button";
import { useAuth } from "@/hooks/use-auth";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/connect", label: "Connect" },
    { href: "/history", label: "History" },
    ...(isAuthenticated ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  useGSAP(() => {
    if (!navRef.current) return;

    // The Floating Island Morphing Logic
    gsap.to(navRef.current, {
      scrollTrigger: {
        trigger: "body",
        start: "top -50",
        end: "top -100",
        scrub: true,
      },
      backgroundColor: "rgba(245, 243, 238, 0.8)", // Background color w/ opacity
      backdropFilter: "blur(24px)",
      borderBottomColor: "rgba(17, 17, 17, 1)",
      borderWidth: "2px",
      y: 16, // Drop down slightly when scrolling
    });
  }, { scope: navRef });

  return (
    <nav
      ref={navRef}
      className="fixed top-0 left-1/2 -translate-x-1/2 w-[95%] max-w-5xl z-50 bg-transparent border-2 border-transparent transition-colors duration-300 rounded-[3rem] mt-4"
    >
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer brutal-hover">
            <div className="p-1.5 bg-accent-red border-2 border-foreground rounded-xl text-surface">
              <Terminal size={18} strokeWidth={3} />
            </div>
            <span className="text-lg font-bold font-heading tracking-tight hidden sm:block">
              CodeCocoon
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1 font-heading">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-4 py-2 font-bold text-sm rounded-[2rem] transition-colors cursor-pointer",
                  isActive(link.href)
                    ? "bg-foreground text-surface"
                    : "text-muted hover:text-foreground hover:bg-foreground/10"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth + Mobile Toggle */}
          <div className="flex items-center gap-3 font-heading">
            <div className="hidden md:block">
              <AuthButton />
            </div>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 border-2 border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors cursor-pointer"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-300 border-t border-foreground/10 bg-surface rounded-b-[2rem] mx-2",
          mobileOpen ? "max-h-96 border-t-2 border-x-2 border-b-2" : "max-h-0 border-transparent border-x-transparent border-b-transparent"
        )}
      >
        <div className="px-4 py-3 space-y-1 font-heading">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-4 py-2.5 font-bold text-sm rounded-[2rem] transition-colors cursor-pointer",
                isActive(link.href)
                  ? "bg-foreground text-surface"
                  : "text-muted hover:text-foreground hover:bg-foreground/10"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 mt-2 border-t border-foreground/10">
            <AuthButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
