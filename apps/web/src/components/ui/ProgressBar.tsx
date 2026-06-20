import { cn } from "@/lib/utils";

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-border", className)}>
      <div className="h-full rounded-full bg-brand-500 transition-[width] duration-300" style={{ width: `${clamped}%` }} />
    </div>
  );
}
