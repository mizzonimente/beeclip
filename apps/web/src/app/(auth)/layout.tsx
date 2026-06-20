import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";

// Layout pubblico per /login e /register: nessun guard, nessuna sidebar,
// solo logo + card centrata. Componente server puro (nessun hook).
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <Link href="/" className="mb-8">
        <Logo size="lg" />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
