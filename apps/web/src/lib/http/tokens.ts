const ACCESS_KEY = "dyn-crm-access-token";
const REFRESH_KEY = "dyn-crm-refresh-token";

export type StoredSession = {
  accessToken: string;
  refreshToken: string;
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
  return { accessToken, refreshToken };
}

export function writeStoredSession(session: StoredSession) {
  localStorage.setItem(ACCESS_KEY, session.accessToken);
  localStorage.setItem(REFRESH_KEY, session.refreshToken);
}

export function clearStoredSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
