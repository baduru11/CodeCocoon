import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  label?: string;
  color?: string;
  className?: string;
}

function Progress({ value, label, color = "bg-accent-green", className }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const isActive = clampedValue > 0 && clampedValue < 100;

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold">{label}</span>
          <span className="text-sm font-bold tabular-nums text-muted">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className="w-full h-3 bg-foreground/5 border border-foreground/10 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-500 ease-out rounded-full",
            color,
            isActive && "progress-stripes"
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

export { Progress };
