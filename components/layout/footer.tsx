import Link from "next/link";
import { Github, Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-surface border-t-4 border-foreground mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-medium text-sm text-muted flex items-center gap-1">
            Built with <Heart size={14} className="text-primary fill-primary" /> for vibe coders ready to spread their wings
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/connect"
              className="text-sm font-bold hover:text-primary transition-colors"
            >
              Get Started
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 border-2 border-foreground rounded-[4px] shadow-[2px_2px_0px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
