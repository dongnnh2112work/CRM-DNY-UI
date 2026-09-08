const STORAGE_KEY = "dyn-oauth-redirect-error";

function decodeOAuthText(value: string | null): string | null {
  if (!value) return null;
  let out = value.replace(/\+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  return out || null;
}

function paramsFromLocation() {
  if (typeof window === "undefined") return new URLSearchParams();
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return new URLSearchParams([...query.entries(), ...hash.entries()]);
}

function remember(message: string) {
  try {
    sessionStorage.setItem(STORAGE_KEY, message);
  } catch {
    /* ignore quota / private mode */
  }
}

function remembered() {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function hasOAuthTokensInLocation() {
  const p = paramsFromLocation();
  return Boolean(p.get("access_token") && p.get("refresh_token"));
}

export function readOAuthHashParams() {
  const p = paramsFromLocation();
  return {
    accessToken: p.get("access_token"),
    refreshToken: p.get("refresh_token"),
    expiresIn: Number(p.get("expires_in") ?? 0),
    error: p.get("error"),
    errorDescription: decodeOAuthText(p.get("error_description")) || decodeOAuthText(p.get("error_code")),
  };
}

/** Supabase / Nest OAuth errors may land on /login or /auth/callback as hash or query. */
export function readOAuthRedirectError() {
  const p = paramsFromLocation();
  if (p.get("access_token") && p.get("refresh_token")) {
    clearRememberedOAuthError();
    return null;
  }
  const error = p.get("error");
  if (error) {
    const message =
      decodeOAuthText(p.get("error_description")) ||
      decodeOAuthText(p.get("error_code")) ||
      decodeOAuthText(error);
    if (message) remember(message);
    return message;
  }
  return remembered();
}

export function readOAuthRedirectErrorCode() {
  const p = paramsFromLocation();
  return p.get("error");
}

export function clearOAuthRedirectParams() {
  if (typeof window === "undefined") return;
  if (!window.location.hash && !window.location.search) return;
  window.history.replaceState(null, "", window.location.pathname);
}

export function clearRememberedOAuthError() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function markOAuthLoginInProgress() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem("dyn-oauth-just-done", "1");
  } catch {
    /* ignore */
  }
}

export function consumeOAuthLoginInProgress() {
  if (typeof window === "undefined") return false;
  try {
    const on = sessionStorage.getItem("dyn-oauth-just-done") === "1";
    sessionStorage.removeItem("dyn-oauth-just-done");
    return on;
  } catch {
    return false;
  }
}

export function isOAuthLoginInProgress() {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem("dyn-oauth-just-done") === "1";
  } catch {
    return false;
  }
}
