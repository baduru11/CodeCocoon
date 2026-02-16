"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthButton } from "./auth-button";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

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

  return (
    <nav className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b-2 border-foreground/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="p-1.5 bg-accent-yellow border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B] group-hover:shadow-none group-hover:translate-x-[1px] group-hover:translate-y-[1px] transition-all">
              <Code2 size={18} strokeWidth={3} />
            </div>
            <span className="text-lg font-bold tracking-tight hidden sm:block">
              CodeCocoon
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "px-3.5 py-2 font-bold text-sm rounded-lg transition-colors cursor-pointer",
                  isActive(link.href)
                    ? "bg-foreground text-surface"
                    : "text-muted hover:text-foreground hover:bg-foreground/5"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Auth + Mobile Toggle */}
          <div className="flex items-center gap-3">
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
          "md:hidden overflow-hidden transition-all duration-300 border-t border-foreground/10 bg-surface/95 backdrop-blur-xl",
          mobileOpen ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <div className="px-4 py-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "block px-4 py-2.5 font-bold text-sm rounded-lg transition-colors cursor-pointer",
                isActive(link.href)
                  ? "bg-foreground text-surface"
                  : "text-muted hover:text-foreground hover:bg-foreground/5"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-foreground/10">
            <AuthButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
