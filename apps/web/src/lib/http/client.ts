import { isAwaitingAccess } from "@/lib/access-gate";
import { reportApiError } from "@/lib/dev-debug";
import { classifyApiError, isBlockedAccountError, isPendingMeError } from "@/lib/http/error-kind";
import { ApiError, parseApiError } from "@/lib/http/errors";
import { isOAuthLoginInProgress } from "@/lib/http/oauth-redirect";
import { readCachedAuthUser } from "@/lib/hydrate-cache";
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

function requestPath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAuthEndpoint(path: string) {
  const p = requestPath(path).split("?")[0];
  return p === "/auth/me" || p === "/auth/logout" || p === "/auth/refresh" || p === "/auth/login";
}

function keepPendingSessionOnFailure(path: string) {
  if (isAuthEndpoint(path)) return false;
  const cached = readCachedAuthUser();
  return Boolean(cached && isAwaitingAccess(cached));
}

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

function emitApiError(path: string, err: ApiError) {
  reportApiError({
    statusCode: err.statusCode,
    path: requestPath(path).split("?")[0],
    messages: err.messages,
    kind: classifyApiError(err),
  });
}

function logoutLocal() {
  clearStoredSession();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dyn-auth-logout"));
  }
}

export async function apiRequest<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { skipAuth, skipRefresh, headers, body, ...rest } = init;
  const url = `${getApiBaseUrl()}${requestPath(path)}`;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const stored = skipAuth ? null : readStoredSession();

  const headerBag = new Headers(headers);
  if (!skipAuth && stored?.accessToken) {
    headerBag.set("Authorization", `Bearer ${stored.accessToken}`);
  }
  if (body != null && !isForm && !headerBag.has("Content-Type")) {
    headerBag.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, { ...rest, headers: headerBag, body });
  } catch (err) {
    reportApiError({
      statusCode: 0,
      path: requestPath(path).split("?")[0],
      messages: [err instanceof Error ? err.message : "network"],
      kind: "network",
    });
    throw err;
  }

  if (res.status === 401 && !skipAuth) {
    if (!skipRefresh) {
      const ok = await refreshAccessToken();
      if (ok) {
        return apiRequest<T>(path, { ...init, skipRefresh: true });
      }
    }
    const err = await parseApiError(res);
    emitApiError(path, err);
    const pathOnly = requestPath(path).split("?")[0];
    const validTokenButNoCrmAccess =
      pathOnly === "/auth/me" &&
      !isBlockedAccountError(err) &&
      (skipRefresh || isPendingMeError(err) || isOAuthLoginInProgress());
    if (validTokenButNoCrmAccess || keepPendingSessionOnFailure(path)) {
      throw err;
    }
    logoutLocal();
    throw err;
  }

  if (!res.ok) {
    const err = await parseApiError(res);
    emitApiError(path, err);
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export { ApiError };
