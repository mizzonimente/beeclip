import { forwardRef, useId } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, id, rows = 4, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={cn(
            "rounded-lg border bg-surface-raised px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-colors",
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
Textarea.displayName = "Textarea";
