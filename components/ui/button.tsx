"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", disabled, loading, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center font-bold font-mono border-2 border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-red focus-visible:ring-offset-2",
          "shadow-[4px_4px_0px_0px_#111111]",
          "brutal-hover",
          "disabled:opacity-50 disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0",
          "rounded-[2rem] cursor-pointer",
          {
            "bg-foreground text-surface hover:bg-foreground/90": variant === "default",
            "bg-accent-red text-surface hover:bg-accent-red-hover": variant === "secondary",
            "bg-surface text-foreground hover:bg-background": variant === "outline",
            "bg-transparent text-foreground border-transparent shadow-none hover:bg-foreground/5 hover:border-transparent hover:shadow-none hover:translate-x-0 hover:translate-y-0":
              variant === "ghost",
            "bg-accent-red text-white hover:bg-accent-red-hover": variant === "destructive",
          },
          {
            "px-4 py-2 text-sm": size === "sm",
            "px-6 py-3 text-sm": size === "md",
            "px-8 py-4 text-base": size === "lg",
            "p-3 aspect-square": size === "icon",
          },
          className
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 size={size === "sm" ? 14 : size === "lg" ? 20 : 16} className="animate-spin" />
            {children && <span className="ml-2">{children}</span>}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
