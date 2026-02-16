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
      <div className="flex gap-1 border-b-2 border-foreground/10 pb-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-2.5 font-bold text-sm transition-all duration-200 rounded-t-lg -mb-[2px] cursor-pointer border-b-2",
              activeTab === tab.id
                ? "text-foreground border-foreground"
                : "text-muted hover:text-foreground border-transparent"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-6">
        {activeContent}
      </div>
    </div>
  );
}

export { Tabs };
export type { Tab };
