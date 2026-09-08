export const DEV_DEBUG_KEY = "dyn-crm-dev-debug";
export const DEV_DEBUG_CHANGE_EVENT = "dyn-dev-debug-change";
export const API_ERROR_EVENT = "dyn-api-error";

export type ApiErrorEventDetail = {
  statusCode: number;
  path: string;
  messages: string[];
  kind: string;
};

export function isDevDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(DEV_DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDevDebugEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (on) localStorage.setItem(DEV_DEBUG_KEY, "1");
    else localStorage.removeItem(DEV_DEBUG_KEY);
  } catch {
    /* ignore quota / private mode */
  }
  window.dispatchEvent(new Event(DEV_DEBUG_CHANGE_EVENT));
}

export function reportApiError(detail: ApiErrorEventDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, { detail }));
}

export function formatDebugError(detail: ApiErrorEventDetail) {
  const body = detail.messages.filter(Boolean).join(" · ") || "(no message)";
  return `[${detail.statusCode} ${detail.kind}] ${detail.path} — ${body}`;
}
