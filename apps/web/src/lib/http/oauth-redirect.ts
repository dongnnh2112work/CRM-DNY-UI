const STORAGE_KEY = "dyn-oauth-redirect-error";
export const OAUTH_PENDING_KEY = "dyn-oauth-pending";

export type OAuthPendingPayload = {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  error: string;
  errorDescription: string;
};

/**
 * Runs before hydration (root layout, beforeInteractive). Stashes OAuth
 * tokens out of the address bar, then replaceState. Does not log the URL.
 * If sessionStorage fails, the URL is left intact so the page can still read it.
 */
export const OAUTH_LOCATION_STRIP_SCRIPT = `(function(){try{var hash=new URLSearchParams(String(location.hash||"").replace(/^#/,""));var query=new URLSearchParams(location.search||"");function pick(k){return hash.get(k)||query.get(k)||"";}var access=pick("access_token");var refresh=pick("refresh_token");var error=pick("error");var desc=pick("error_description")||pick("error_code");var exp=pick("expires_in");if(!access&&!refresh&&!error&&!desc)return;sessionStorage.setItem(${JSON.stringify(OAUTH_PENDING_KEY)},JSON.stringify({accessToken:access,refreshToken:refresh,expiresIn:exp,error:error,errorDescription:desc}));history.replaceState(null,"",location.pathname);}catch(e){}})();`;

function readPendingPayload(): OAuthPendingPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(OAUTH_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OAuthPendingPayload>;
    return {
      accessToken: String(parsed.accessToken ?? ""),
      refreshToken: String(parsed.refreshToken ?? ""),
      expiresIn: String(parsed.expiresIn ?? ""),
      error: String(parsed.error ?? ""),
      errorDescription: String(parsed.errorDescription ?? ""),
    };
  } catch {
    return null;
  }
}

export function clearPendingOAuthPayload() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(OAUTH_PENDING_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function prefer(pendingValue: string, locationValue: string | null): string | null {
  const fromPending = pendingValue.trim();
  if (fromPending) return fromPending;
  const fromLocation = locationValue?.trim();
  return fromLocation ? fromLocation : null;
}

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
  const pending = readPendingPayload();
  if (pending?.accessToken && pending.refreshToken) return true;
  const p = paramsFromLocation();
  return Boolean(p.get("access_token") && p.get("refresh_token"));
}

export function readOAuthHashParams() {
  const pending = readPendingPayload();
  const p = paramsFromLocation();
  const expiresRaw = prefer(pending?.expiresIn ?? "", p.get("expires_in"));
  return {
    accessToken: prefer(pending?.accessToken ?? "", p.get("access_token")),
    refreshToken: prefer(pending?.refreshToken ?? "", p.get("refresh_token")),
    expiresIn: Number(expiresRaw ?? 0),
    error: prefer(pending?.error ?? "", p.get("error")),
    errorDescription:
      decodeOAuthText(prefer(pending?.errorDescription ?? "", p.get("error_description"))) ||
      decodeOAuthText(p.get("error_code")),
  };
}

/** Supabase / Nest OAuth errors may land on /login or /auth/callback as hash or query. */
export function readOAuthRedirectError() {
  const pending = readPendingPayload();
  const p = paramsFromLocation();
  if ((pending?.accessToken && pending.refreshToken) || (p.get("access_token") && p.get("refresh_token"))) {
    clearRememberedOAuthError();
    return null;
  }
  const error = prefer(pending?.error ?? "", p.get("error"));
  if (error) {
    const message =
      decodeOAuthText(prefer(pending?.errorDescription ?? "", p.get("error_description"))) ||
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
  clearPendingOAuthPayload();
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
