"use client";

// Punto unico in cui montare i provider client-side (oggi solo l'auth
// context; futuri provider globali — toast, query cache — vanno aggiunti
// qui per non toccare il root layout ad ogni aggiunta).
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";

export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
