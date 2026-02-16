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
    <div className="flex gap-1 border-b-2 border-foreground/10">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex items-center gap-2 px-5 py-3 font-bold text-sm transition-all duration-200 -mb-[2px] border-b-2 cursor-pointer",
              isActive
                ? "text-foreground border-primary"
                : "text-muted border-transparent hover:text-foreground hover:border-foreground/20"
            )}
          >
            <Icon size={16} />
            {tab.label}
            {tab.id === "exercises" && exerciseProgress && exerciseProgress.total > 0 && (
              <span
                className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "bg-foreground/5 text-muted"
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
