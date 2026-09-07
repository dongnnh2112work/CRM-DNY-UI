import { clearClientCaches } from "@/lib/hydrate-cache";

const ACCESS_KEY = "dyn-crm-access-token";
const REFRESH_KEY = "dyn-crm-refresh-token";
const EXPIRES_KEY = "dyn-crm-expires-in";

export const SESSION_SAVED_EVENT = "dyn-auth-session-saved";

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

const DEFAULT_API_URL = "https://apidyn.otcayxe.com/api/v1";

export function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL).replace(/\/$/, "");
}

export function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const accessToken = localStorage.getItem(ACCESS_KEY);
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  const expiresRaw = localStorage.getItem(EXPIRES_KEY);
  const expiresIn = expiresRaw != null ? Number(expiresRaw) : undefined;
  return {
    accessToken,
    refreshToken,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : undefined,
  };
}

export function writeStoredSession(session: StoredSession) {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
  if (typeof session.expiresIn === "number" && Number.isFinite(session.expiresIn)) {
    localStorage.setItem(EXPIRES_KEY, String(session.expiresIn));
  }
}

export function saveSession(session: StoredSession) {
  writeStoredSession(session);
  window.dispatchEvent(new Event(SESSION_SAVED_EVENT));
}

export function clearStoredSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
  clearClientCaches();
}
