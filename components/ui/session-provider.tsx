"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  clearOperonSession,
  operonMe,
  operonToken,
  operonUser,
  type OperonUser,
} from "@/lib/operon-api";

interface OperonSessionContextValue {
  user: OperonUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const OperonSessionContext = createContext<OperonSessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<OperonUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const token = operonToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const nextUser = await operonMe();
      setUser(nextUser);
      window.localStorage.setItem("operon_user", JSON.stringify(nextUser));
    } catch {
      clearOperonSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setUser(operonUser());
    void refresh();
    const onAuthChange = () => void refresh();
    window.addEventListener("operon-auth-change", onAuthChange);
    return () => window.removeEventListener("operon-auth-change", onAuthChange);
  }, []);

  const value = useMemo<OperonSessionContextValue>(
    () => ({
      user,
      loading,
      refresh,
      signOut: () => {
        clearOperonSession();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <OperonSessionContext.Provider value={value}>{children}</OperonSessionContext.Provider>;
}

export function useOperonSession() {
  const context = useContext(OperonSessionContext);
  if (!context) throw new Error("useOperonSession must be used inside SessionProvider");
  return context;
}
