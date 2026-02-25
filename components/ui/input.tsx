import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full px-4 py-3 bg-surface border-2 border-foreground rounded-brutal-sm font-mono font-bold text-sm",
            "shadow-brutal-sm focus:shadow-none focus:-translate-x-0 focus:-translate-y-0 focus:translate-x-[2px] focus:translate-y-[2px]",
            "focus:border-accent-red focus:outline-none focus-visible:ring-0",
            "transition-all duration-200",
            "placeholder:text-muted/50",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-accent-red focus:border-accent-red shadow-[2px_2px_0px_0px_#E63B2E]",
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-sm font-medium text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
