"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center font-bold border-3 border-foreground transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2",
          "shadow-[5px_5px_0px_0px_#1A1A1A]",
          "hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none",
          "active:translate-x-[5px] active:translate-y-[5px] active:shadow-none",
          "disabled:opacity-50 disabled:pointer-events-none disabled:translate-x-0 disabled:translate-y-0",
          "rounded-[4px]",
          {
            "bg-primary text-white": variant === "default",
            "bg-secondary text-white": variant === "secondary",
            "bg-surface text-foreground": variant === "outline",
            "bg-transparent text-foreground border-transparent shadow-none hover:bg-surface hover:border-foreground hover:shadow-[5px_5px_0px_0px_#1A1A1A] hover:translate-x-0 hover:translate-y-0":
              variant === "ghost",
            "bg-red-500 text-white": variant === "destructive",
          },
          {
            "px-3 py-1.5 text-sm": size === "sm",
            "px-5 py-2.5 text-base": size === "md",
            "px-7 py-3.5 text-lg": size === "lg",
          },
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button };
