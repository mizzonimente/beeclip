"use client";

// Provider React per lo stato di autenticazione: carica l'utente corrente
// all'avvio (se c'è un access token salvato), espone login/register/logout
// e un flag `loading` per evitare flash di contenuto protetto prima della
// verifica iniziale. Usato da tutte le pagine sotto src/app/(app)/*.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { LoginInput, RegisterInput } from "@clipmanager/shared";
import { api, ApiError, clearTokens, getAccessToken, setTokens } from "./api";
import type { AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.auth.me();
      setUser(me);
    } catch (err) {
      // Token non valido/refresh fallito: l'utente non è autenticato.
      if (err instanceof ApiError) clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const login = useCallback(
    async (data: LoginInput) => {
      const res = await api.auth.login(data);
      setTokens(res);
      setUser(res.user);
    },
    [],
  );

  const register = useCallback(
    async (data: RegisterInput) => {
      const res = await api.auth.register(data);
      setTokens(res);
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, logout, refreshUser: loadUser }),
    [user, loading, login, register, logout, loadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro <AuthProvider>");
  return ctx;
}
