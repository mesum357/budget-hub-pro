import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/apiBase";

export type MeState =
  | { role: "admin" }
  | { role: "subadmin"; user: { id: string; name: string; email: string } }
  | null;

type AuthContextValue = {
  me: MeState;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setFromLogin: (m: MeState) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<MeState>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const r = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
    const data = await r.json();
    if (!data?.role) setMe(null);
    else if (data.role === "admin") setMe({ role: "admin" });
    else if (data.role === "subadmin" && data.user) setMe({ role: "subadmin", user: data.user });
    else setMe(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    await fetch(apiUrl("/api/auth/logout"), { method: "POST", credentials: "include" });
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, loading, refresh, logout, setFromLogin: setMe }),
    [me, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
