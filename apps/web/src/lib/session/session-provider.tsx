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
import { readCachedAuthUser, writeCachedAuthUser } from "@/lib/hydrate-cache";
import { clearStoredSession, readStoredSession, SESSION_SAVED_EVENT, writeStoredSession } from "@/lib/http/tokens";
import { authApi, type AuthUser, type SessionResponse } from "@/modules/auth/api";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  can: (permission: string) => boolean;
  applySession: (session: SessionResponse) => void;
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
      expiresIn: session.expiresIn,
    });
    writeCachedAuthUser(session.user);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  const restoreFromStorage = useCallback(async () => {
    const stored = readStoredSession();
    if (!stored) {
      setUser(null);
      setStatus("anonymous");
      return;
    }

    const cached = readCachedAuthUser();
    setUser(cached);
    setStatus("authenticated");

    try {
      const me = await authApi.me();
      writeCachedAuthUser(me);
      setUser(me);
      setStatus("authenticated");
    } catch {
      clearStoredSession();
      setUser(null);
      setStatus("anonymous");
    }
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
    void restoreFromStorage();
  }, [restoreFromStorage]);

  useEffect(() => {
    const onSaved = () => {
      void restoreFromStorage();
    };
    window.addEventListener(SESSION_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SESSION_SAVED_EVENT, onSaved);
  }, [restoreFromStorage]);

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
    () => ({ status, user, can, applySession, logout }),
    [status, user, can, applySession, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
