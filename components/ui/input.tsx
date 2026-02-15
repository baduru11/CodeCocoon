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
          <label htmlFor={inputId} className="text-sm font-bold text-foreground">
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-surface border-3 border-foreground rounded-[4px] font-medium",
            "shadow-[3px_3px_0px_0px_#1A1A1A]",
            "focus:shadow-[5px_5px_0px_0px_#1A1A1A] focus:outline-none",
            "transition-shadow",
            "placeholder:text-muted/60",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-500 shadow-[3px_3px_0px_0px_#ef4444]",
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
