"use client";

import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlatformRecommendation, ResourceIntent } from "@/types/learning";

interface ResourceCardProps {
  resource: PlatformRecommendation;
  compact?: boolean;
}

const INTENT_CONFIG: Record<ResourceIntent, { label: string; color: string }> = {
  start_here: { label: "Start Here", color: "bg-accent-green/10 text-accent-green border-accent-green/30" },
  go_deeper: { label: "Go Deeper", color: "bg-accent-purple/10 text-accent-purple border-accent-purple/30" },
  quick_reference: { label: "Reference", color: "bg-secondary/10 text-secondary border-secondary/30" },
};

const PRICE_CONFIG: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "text-accent-green" },
  paid: { label: "Paid", color: "text-accent-yellow" },
  subscription: { label: "Subscription", color: "text-secondary" },
};

export function ResourceCard({ resource, compact }: ResourceCardProps) {
  const intent = INTENT_CONFIG[resource.intent] || INTENT_CONFIG.start_here;
  const price = PRICE_CONFIG[resource.priceTier] || PRICE_CONFIG.free;

  if (compact) {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5",
          "rounded-lg border border-foreground/15 bg-surface",
          "text-secondary hover:bg-secondary/10 hover:border-secondary/30",
          "transition-all duration-200 cursor-pointer"
        )}
      >
        <ExternalLink size={10} />
        {resource.platform}
        <span className="text-muted font-medium">· {resource.type}</span>
      </a>
    );
  }

  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block p-4 rounded-xl border-2 border-foreground/10 bg-surface",
        "hover:border-foreground/25 hover:shadow-[2px_2px_0px_0px_#1E293B]",
        "transition-all duration-200 cursor-pointer group"
      )}
    >
      {/* Platform + Intent */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-primary uppercase tracking-wide">
          {resource.platform}
        </span>
        <Badge className={cn("text-[10px]", intent.color)}>
          {intent.label}
        </Badge>
      </div>

      {/* Title */}
      <p className="text-sm font-bold mb-1 group-hover:text-primary transition-colors flex items-center gap-1.5">
        {resource.title}
        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </p>

      {/* Why this resource */}
      <p className="text-xs text-muted font-medium mb-3 leading-relaxed">
        {resource.whyThisResource}
      </p>

      {/* Meta badges */}
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[10px] font-bold px-1.5 py-0.5 border rounded-md bg-foreground/5 border-foreground/15">
          {resource.type}
        </span>
        <span className="text-[10px] font-bold px-1.5 py-0.5 border rounded-md bg-foreground/5 border-foreground/15 capitalize">
          {resource.difficulty}
        </span>
        {resource.estimatedDuration && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 border rounded-md bg-foreground/5 border-foreground/15">
            {resource.estimatedDuration}
          </span>
        )}
        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 border rounded-md bg-foreground/5 border-foreground/15", price.color)}>
          {price.label}
        </span>
      </div>
    </a>
  );
}

interface ResourceGroupProps {
  resources: PlatformRecommendation[];
}

export function ResourceGroup({ resources }: ResourceGroupProps) {
  const grouped = {
    start_here: resources.filter((r) => r.intent === "start_here"),
    go_deeper: resources.filter((r) => r.intent === "go_deeper"),
    quick_reference: resources.filter((r) => r.intent === "quick_reference"),
  };

  return (
    <div className="space-y-4">
      {(["start_here", "go_deeper", "quick_reference"] as ResourceIntent[]).map((intent) => {
        const group = grouped[intent];
        if (group.length === 0) return null;
        const config = INTENT_CONFIG[intent];
        return (
          <div key={intent}>
            <h4 className="text-xs font-bold text-muted uppercase tracking-wide mb-2">
              {config.label}
            </h4>
            <div className="grid gap-3">
              {group.map((resource, i) => (
                <ResourceCard key={i} resource={resource} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
