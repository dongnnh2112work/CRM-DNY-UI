import { ApiError, parseApiError } from "@/lib/http/errors";
import {
  clearStoredSession,
  getApiBaseUrl,
  readStoredSession,
  writeStoredSession,
} from "@/lib/http/tokens";

type RequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const stored = readStoredSession();
    if (!stored?.refreshToken) return false;
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: stored.refreshToken }),
    });
    if (!res.ok) {
      clearStoredSession();
      return false;
    }
    const data = (await res.json()) as { accessToken?: string; refreshToken?: string };
    if (!data.accessToken || !data.refreshToken) {
      clearStoredSession();
      return false;
    }
    writeStoredSession({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    return true;
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

export async function apiRequest<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { skipAuth, skipRefresh, headers, body, ...rest } = init;
  const url = `${getApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const stored = skipAuth ? null : readStoredSession();

  const headerBag = new Headers(headers);
  if (!skipAuth && stored?.accessToken) {
    headerBag.set("Authorization", `Bearer ${stored.accessToken}`);
  }
  if (body != null && !isForm && !headerBag.has("Content-Type")) {
    headerBag.set("Content-Type", "application/json");
  }

  const res = await fetch(url, { ...rest, headers: headerBag, body });

  if (res.status === 401 && !skipAuth) {
    if (!skipRefresh) {
      const ok = await refreshAccessToken();
      if (ok) {
        return apiRequest<T>(path, { ...init, skipRefresh: true });
      }
    }
    clearStoredSession();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("dyn-auth-logout"));
    }
    throw await parseApiError(res);
  }

  if (!res.ok) {
    throw await parseApiError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export { ApiError };
