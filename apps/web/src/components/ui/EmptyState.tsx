import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-surface-border px-6 py-12 text-center">
      {icon && <div className="text-slate-500">{icon}</div>}
      <div className="space-y-1">
        <p className="font-medium text-slate-200">{title}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
