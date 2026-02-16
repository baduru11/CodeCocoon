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
          "inline-flex items-center justify-center font-bold border-2 border-foreground transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "shadow-[3px_3px_0px_0px_#1E293B]",
          "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
          "disabled:opacity-50 disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0",
          "rounded-lg cursor-pointer",
          {
            "bg-primary text-white hover:bg-primary-hover": variant === "default",
            "bg-secondary text-white hover:bg-secondary-hover": variant === "secondary",
            "bg-surface text-foreground hover:bg-background": variant === "outline",
            "bg-transparent text-foreground border-transparent shadow-none hover:bg-foreground/5 hover:border-transparent hover:shadow-none hover:translate-x-0 hover:translate-y-0":
              variant === "ghost",
            "bg-red-500 text-white hover:bg-red-600": variant === "destructive",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-2.5 text-sm": size === "md",
            "px-7 py-3 text-base": size === "lg",
            "p-2.5 aspect-square": size === "icon",
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
