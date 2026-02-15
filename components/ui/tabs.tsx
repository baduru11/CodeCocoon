"use client";

import { cn } from "@/lib/utils";
import { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  className?: string;
}

function Tabs({ tabs, defaultTab, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-0 border-b-3 border-foreground">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-2.5 font-bold text-sm transition-all border-3 border-foreground border-b-0 rounded-t-[4px] -mb-[3px]",
              activeTab === tab.id
                ? "bg-surface shadow-[3px_-3px_0px_0px_#1A1A1A] text-foreground z-10"
                : "bg-muted/10 text-muted hover:bg-muted/20"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6 bg-surface border-3 border-t-0 border-foreground rounded-b-[4px] shadow-[5px_5px_0px_0px_#1A1A1A]">
        {activeContent}
      </div>
    </div>
  );
}

export { Tabs };
export type { Tab };
