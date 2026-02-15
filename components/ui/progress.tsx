import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number; // 0-100
  label?: string;
  color?: string;
  className?: string;
}

function Progress({ value, label, color = "bg-accent-green", className }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-sm font-bold">{label}</span>
          <span className="text-sm font-bold">{Math.round(clampedValue)}%</span>
        </div>
      )}
      <div className="w-full h-6 bg-surface border-3 border-foreground rounded-[4px] shadow-[3px_3px_0px_0px_#1A1A1A] overflow-hidden">
        <div
          className={cn("h-full transition-all duration-500 ease-out", color)}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

export { Progress };
