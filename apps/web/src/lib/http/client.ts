import { isAwaitingAccess } from "@/lib/access-gate";
import { reportApiError } from "@/lib/dev-debug";
import { classifyApiError, isBlockedAccountError, isPendingMeError } from "@/lib/http/error-kind";
import { ApiError, parseApiError, parseApiErrorText } from "@/lib/http/errors";
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
  skipErrorEmit?: boolean;
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
  const { skipAuth, skipRefresh, skipErrorEmit, headers, body, ...rest } = init;
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
    if (!skipErrorEmit) emitApiError(path, err);
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
    if (!skipErrorEmit) emitApiError(path, err);
    throw err;
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

/** Multipart upload with browser→API percent. `fetch` cannot report xhr.upload progress. */
export async function apiUpload<T>(
  path: string,
  form: FormData,
  onProgress?: (percent: number) => void,
  init: { skipRefresh?: boolean; skipErrorEmit?: boolean } = {},
): Promise<T> {
  const url = `${getApiBaseUrl()}${requestPath(path)}`;
  const stored = readStoredSession();

  const send = () =>
    new Promise<T>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      if (stored?.accessToken) {
        xhr.setRequestHeader("Authorization", `Bearer ${stored.accessToken}`);
      }
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };
      xhr.onload = () => {
        const text = xhr.responseText ?? "";
        if (xhr.status === 401) {
          const err = parseApiErrorText(xhr.status, text, xhr.statusText);
          reject(err);
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          const err = parseApiErrorText(xhr.status, text, xhr.statusText);
          if (!init.skipErrorEmit) emitApiError(path, err);
          reject(err);
          return;
        }
        onProgress?.(100);
        if (xhr.status === 204 || !text) {
          resolve(undefined as T);
          return;
        }
        try {
          resolve(JSON.parse(text) as T);
        } catch {
          reject(new ApiError(xhr.status, [text.slice(0, 240) || "Invalid JSON"]));
        }
      };
      xhr.onerror = () => {
        const err = new ApiError(0, ["network"]);
        if (!init.skipErrorEmit) {
          reportApiError({
            statusCode: 0,
            path: requestPath(path).split("?")[0],
            messages: ["network"],
            kind: "network",
          });
        }
        reject(err);
      };
      xhr.send(form);
    });

  try {
    return await send();
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) {
      if (!init.skipRefresh) {
        const ok = await refreshAccessToken();
        if (ok) {
          return apiUpload<T>(path, form, onProgress, { ...init, skipRefresh: true });
        }
      }
      if (!init.skipErrorEmit) emitApiError(path, err);
      if (!keepPendingSessionOnFailure(path)) logoutLocal();
    }
    throw err;
  }
}

export { ApiError };
