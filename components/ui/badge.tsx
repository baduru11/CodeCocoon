import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 text-xs font-bold border-2 border-foreground rounded-[4px]",
        "shadow-[2px_2px_0px_0px_#1A1A1A]",
        {
          "bg-surface text-foreground": variant === "default",
          "bg-primary text-white": variant === "primary",
          "bg-secondary text-white": variant === "secondary",
          "bg-accent-green text-foreground": variant === "success",
          "bg-accent-yellow text-foreground": variant === "warning",
          "bg-red-500 text-white": variant === "danger",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
