import Link from "next/link";
import { Github, Heart, Code2 } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-surface border-t-2 border-foreground/10 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-accent-yellow border-2 border-foreground rounded-lg shadow-[2px_2px_0px_0px_#1E293B]">
              <Code2 size={16} strokeWidth={3} />
            </div>
            <span className="font-bold text-lg">CodeCocoon</span>
          </div>
          <nav className="flex flex-wrap items-center gap-5">
            <Link href="/" className="text-sm font-bold text-muted hover:text-foreground transition-colors">
              Home
            </Link>
            <Link href="/connect" className="text-sm font-bold text-muted hover:text-foreground transition-colors">
              Connect
            </Link>
            <Link href="/history" className="text-sm font-bold text-muted hover:text-foreground transition-colors">
              History
            </Link>
          </nav>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-foreground/10">
          <p className="font-medium text-sm text-muted flex items-center gap-1.5">
            Built with <Heart size={14} className="text-accent-pink fill-accent-pink" /> for vibe coders ready to spread their wings
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted font-medium">&copy; {new Date().getFullYear()} CodeCocoon</span>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border-2 border-foreground/20 rounded-lg hover:border-foreground/40 hover:bg-foreground/5 transition-all cursor-pointer"
              aria-label="GitHub"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
