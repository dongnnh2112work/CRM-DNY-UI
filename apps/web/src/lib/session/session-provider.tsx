"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clearStoredSession, readStoredSession, writeStoredSession } from "@/lib/http/tokens";
import { authApi, type AuthUser, type SessionResponse } from "@/modules/auth/api";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  can: (permission: string) => boolean;
  applySession: (session: SessionResponse) => void;
  applyTokens: (accessToken: string, refreshToken: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  const applySession = useCallback((session: SessionResponse) => {
    writeStoredSession({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
    });
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const applyTokens = useCallback(async (accessToken: string, refreshToken: string) => {
    writeStoredSession({ accessToken, refreshToken });
    const me = await authApi.me();
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* still clear local session */
    }
    clearStoredSession();
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const stored = readStoredSession();
      if (!stored) {
        if (!cancelled) setStatus("anonymous");
        return;
      }
      try {
        const me = await authApi.me();
        if (cancelled) return;
        setUser(me);
        setStatus("authenticated");
      } catch {
        if (cancelled) return;
        clearStoredSession();
        setUser(null);
        setStatus("anonymous");
      }
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setStatus("anonymous");
    };
    window.addEventListener("dyn-auth-logout", onLogout);
    return () => window.removeEventListener("dyn-auth-logout", onLogout);
  }, []);

  const can = useCallback(
    (permission: string) => Boolean(user?.permissions.includes(permission)),
    [user],
  );

  const value = useMemo(
    () => ({ status, user, can, applySession, applyTokens, logout }),
    [status, user, can, applySession, applyTokens, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
