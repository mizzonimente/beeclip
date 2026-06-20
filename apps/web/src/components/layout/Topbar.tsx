"use client";

import { Logo } from "./Logo";

// Visibile solo sotto il breakpoint lg (vedi (app)/layout.tsx): su desktop la
// Sidebar è sempre visibile e questa barra non serve.
export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-surface-border px-4 lg:hidden">
      <button
        onClick={onMenuClick}
        aria-label="Apri il menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-surface-border text-slate-300"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <Logo size="sm" />
    </header>
  );
}
