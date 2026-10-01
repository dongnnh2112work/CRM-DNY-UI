"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { accessGate, isAwaitingAccess } from "@/lib/access-gate";
import {
  classifyApiError,
  isBlockedAccountError,
  isPendingMeError,
  placeholderPendingUser,
} from "@/lib/http/error-kind";
import { writeAuthNotice } from "@/lib/http/auth-notice";
import {
  consumeOAuthLoginInProgress,
  hasOAuthTokensInLocation,
  isOAuthLoginInProgress,
} from "@/lib/http/oauth-redirect";
import { ApiError } from "@/lib/http/errors";
import { clearClientCaches, purgePersistedServerCaches, setLastKnownAuthUser } from "@/lib/hydrate-cache";
import { rememberUserName } from "@/lib/entity-lookups";
import {
  clearStoredSession,
  readStoredSession,
  SESSION_SAVED_EVENT,
  writeStoredSession,
} from "@/lib/http/tokens";
import { authApi, type AuthUser, type SessionResponse } from "@/modules/auth/api";

type SessionStatus = "loading" | "authenticated" | "anonymous";

type SessionContextValue = {
  status: SessionStatus;
  user: AuthUser | null;
  can: (permission: string) => boolean;
  hasPermission: (permission: string) => boolean;
  isPendingApproval: boolean;
  applySession: (session: SessionResponse) => void;
  applyProfile: (user: AuthUser) => void;
  refreshMe: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

/** Skip SESSION_SAVED → restore right after password/OAuth applySession. */
let skipRestoreUntil = 0;

export function markSessionJustApplied(ms = 2500) {
  skipRestoreUntil = Date.now() + ms;
}

function peekJwtEmail(accessToken: string) {
  try {
    const part = accessToken.split(".")[1];
    if (!part) return "";
    const padded = part.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    const payload = JSON.parse(json) as { email?: string; user_metadata?: { email?: string } };
    return payload.email || payload.user_metadata?.email || "";
  } catch {
    return "";
  }
}

async function loadMeOrPending(): Promise<AuthUser> {
  try {
    const me = await authApi.me();
    consumeOAuthLoginInProgress();
    return me;
  } catch (err) {
    const stored = readStoredSession();
    const pendingLike =
      isPendingMeError(err) ||
      (err instanceof ApiError &&
        err.isUnauthorized &&
        stored &&
        !isBlockedAccountError(err) &&
        (consumeOAuthLoginInProgress() || isOAuthLoginInProgress()));
    if (pendingLike) {
      const email = stored?.accessToken ? peekJwtEmail(stored.accessToken) : "";
      return placeholderPendingUser(email);
    }
    throw err;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);
  const userIdRef = useRef<string | null>(null);

  const applyProfile = useCallback((next: AuthUser) => {
    setLastKnownAuthUser(next);
    userIdRef.current = next.id;
    if (next.id && (next.displayName || next.email)) {
      rememberUserName(next.id, next.displayName || next.email);
    }
    setUser(next);
    setStatus("authenticated");
  }, []);

  const applySession = useCallback(
    (session: SessionResponse) => {
      markSessionJustApplied();
      writeStoredSession({
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresIn: session.expiresIn,
      });
      applyProfile(session.user);
    },
    [applyProfile],
  );

  const restoreFromStorage = useCallback(async () => {
    if (hasOAuthTokensInLocation() || isOAuthLoginInProgress()) {
      return;
    }

    const stored = readStoredSession();
    if (!stored) {
      setLastKnownAuthUser(null);
      userIdRef.current = null;
      setUser(null);
      setStatus("anonymous");
      return;
    }

    // Stay on loading until /auth/me resolves — never paint a cached user.
    setStatus("loading");

    try {
      const me = await loadMeOrPending();
      applyProfile(me);
    } catch (err) {
      const kind = classifyApiError(err);
      if (kind === "blocked" || kind === "unauthorized") {
        writeAuthNotice(kind === "blocked" ? "blocked" : "unauthorized");
        clearStoredSession();
        setLastKnownAuthUser(null);
        userIdRef.current = null;
        setUser(null);
        setStatus("anonymous");
        return;
      }
      if (kind === "network" || kind === "server") {
        writeAuthNotice(kind);
      }
      setLastKnownAuthUser(null);
      userIdRef.current = null;
      setUser(null);
      setStatus("anonymous");
    }
  }, [applyProfile]);

  const refreshMe = useCallback(async () => {
    if (!readStoredSession()) return null;
    try {
      const me = await loadMeOrPending();
      applyProfile(me);
      return me;
    } catch (err) {
      if (err instanceof ApiError && err.isUnauthorized) {
        clearStoredSession();
        setLastKnownAuthUser(null);
        userIdRef.current = null;
        setUser(null);
        setStatus("anonymous");
      }
      return null;
    }
  }, [applyProfile]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* still clear local session */
    }
    clearStoredSession();
    setLastKnownAuthUser(null);
    userIdRef.current = null;
    setUser(null);
    setStatus("anonymous");
  }, []);

  useEffect(() => {
    // One-time: drop leftover server snapshots from older builds (tokens stay).
    purgePersistedServerCaches();
    void restoreFromStorage();
  }, [restoreFromStorage]);

  useEffect(() => {
    const onSaved = () => {
      if (isOAuthLoginInProgress()) return;
      // Password login / applySession already set the user — do not re-hydrate.
      if (Date.now() < skipRestoreUntil) return;
      void restoreFromStorage();
    };
    window.addEventListener(SESSION_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(SESSION_SAVED_EVENT, onSaved);
  }, [restoreFromStorage]);

  useEffect(() => {
    const onLogout = () => {
      clearClientCaches();
      setLastKnownAuthUser(null);
      userIdRef.current = null;
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

  const isPendingApproval = accessGate(user) === "pending";

  const value = useMemo(
    () => ({
      status,
      user,
      can,
      hasPermission: can,
      isPendingApproval,
      applySession,
      applyProfile,
      refreshMe,
      logout,
    }),
    [status, user, can, isPendingApproval, applySession, applyProfile, refreshMe, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
