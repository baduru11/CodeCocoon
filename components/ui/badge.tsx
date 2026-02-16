import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-bold border rounded-md",
        {
          "bg-foreground/5 text-foreground border-foreground/20": variant === "default",
          "bg-primary/10 text-primary border-primary/30": variant === "primary",
          "bg-secondary/10 text-secondary border-secondary/30": variant === "secondary",
          "bg-accent-green/10 text-accent-green border-accent-green/30": variant === "success",
          "bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30": variant === "warning",
          "bg-red-500/10 text-red-500 border-red-500/30": variant === "danger",
          "bg-transparent text-foreground border-foreground/20": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
