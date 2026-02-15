"use client";

import { cn } from "@/lib/utils";
import { BookOpen, GraduationCap, Dumbbell } from "lucide-react";

export type TabId = "summary" | "learn" | "exercises";

interface SectionTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  exerciseProgress?: { completed: number; total: number };
}

const TABS: { id: TabId; label: string; icon: typeof BookOpen }[] = [
  { id: "summary", label: "Summary", icon: BookOpen },
  { id: "learn", label: "Learning Path", icon: GraduationCap },
  { id: "exercises", label: "Exercises", icon: Dumbbell },
];

export function SectionTabs({ activeTab, onTabChange, exerciseProgress }: SectionTabsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-[4px] font-bold text-sm border-3 transition-all",
              isActive
                ? "bg-secondary text-white border-foreground shadow-[3px_3px_0px_0px_#1A1A1A]"
                : "bg-surface text-muted border-foreground/20 hover:border-foreground/40 hover:translate-x-[1px] hover:translate-y-[1px]"
            )}
          >
            <Icon size={16} />
            {tab.label}
            {tab.id === "exercises" && exerciseProgress && exerciseProgress.total > 0 && (
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-bold",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-foreground/10 text-muted"
                )}
              >
                {exerciseProgress.completed}/{exerciseProgress.total}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
