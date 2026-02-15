"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AuthButton } from "./auth-button";
import { useAuth } from "@/hooks/use-auth";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { isAuthenticated } = useAuth();

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/connect", label: "Connect" },
    { href: "/history", label: "History" },
    ...(isAuthenticated ? [{ href: "/dashboard", label: "Dashboard" }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 bg-surface border-b-4 border-foreground shadow-[0px_4px_0px_0px_#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="p-1.5 bg-accent-yellow border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A] group-hover:translate-x-[2px] group-hover:translate-y-[2px] group-hover:shadow-none transition-all">
              <Code2 size={20} strokeWidth={3} />
            </div>
            <span className="text-xl font-bold tracking-tight hidden sm:block">
              CodeCocoon
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 font-bold text-sm hover:bg-accent-yellow/30 rounded-[4px] transition-colors"
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
              className="md:hidden p-2 border-2 border-foreground rounded-[4px] hover:bg-muted/20 transition-colors"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t-3 border-foreground bg-surface">
          <div className="px-4 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-4 py-2.5 font-bold text-sm hover:bg-accent-yellow/30 rounded-[4px] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t-2 border-foreground/20">
              <AuthButton />
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
