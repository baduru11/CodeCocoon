import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border-2 rounded-sm",
        {
          "bg-foreground text-surface border-foreground": variant === "default",
          "bg-accent-red text-surface border-accent-red": variant === "primary",
          "bg-surface text-foreground border-foreground": variant === "secondary",
          "bg-[#2E4036] text-[#F2F0E9] border-[#2E4036]": variant === "success",
          "bg-[#C9A84C] text-[#0D0D12] border-[#C9A84C]": variant === "warning",
          "bg-accent-red text-surface border-accent-red": variant === "danger",
          "bg-transparent text-foreground border-foreground": variant === "outline",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
