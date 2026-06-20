import { forwardRef, useId } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 rounded-lg border bg-surface-raised px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors",
            "focus:border-brand-400 focus:ring-1 focus:ring-brand-400/50",
            error ? "border-red-500/70" : "border-surface-border",
            className,
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error ? (
          <p className="text-sm text-red-400">{error}</p>
        ) : helperText ? (
          <p className="text-sm text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = "Input";
