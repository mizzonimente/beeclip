"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "./Logo";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/projects", label: "Progetti" },
  { href: "/social-profiles", label: "Profili social" },
  { href: "/trends", label: "Trend" },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-surface-border bg-surface-raised/60">
      <div className="px-5 py-5">
        <Logo />
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "block rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-brand-500 bg-brand-500/15 text-brand-300"
                  : "border-transparent text-slate-400 hover:bg-surface-border/50 hover:text-slate-100",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-surface-border px-4 py-4">
        <p className="truncate text-sm font-medium text-slate-200">{user?.name}</p>
        <p className="truncate text-xs text-slate-500">{user?.email}</p>
        <button
          onClick={logout}
          className="mt-3 w-full rounded-lg border border-surface-border px-3 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-400"
        >
          Esci
        </button>
      </div>
    </aside>
  );
}
