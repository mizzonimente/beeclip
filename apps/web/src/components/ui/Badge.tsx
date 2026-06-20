import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant = "neutral" | "brand" | "success" | "danger" | "warning";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  brand: "bg-brand-500/15 text-brand-300 border-brand-500/30",
  success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  danger: "bg-red-500/15 text-red-300 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
