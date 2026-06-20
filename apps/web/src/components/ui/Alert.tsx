import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertVariant = "error" | "success" | "info";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "border-red-500/30 bg-red-500/10 text-red-300",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  info: "border-brand-500/30 bg-brand-500/10 text-brand-300",
};

export function Alert({
  variant = "info",
  children,
  className,
}: {
  variant?: AlertVariant;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn("rounded-lg border px-4 py-3 text-sm", VARIANT_CLASSES[variant], className)}
    >
      {children}
    </div>
  );
}
