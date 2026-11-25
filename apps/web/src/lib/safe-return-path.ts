import { destinationForUser } from "@/lib/access-gate";
import type { AuthUser } from "@/modules/auth/api";

const RETURN_STORAGE_KEY = "dny-crm-return-path";

/** App routes a session kick may send the user back to. */
const INTERNAL_PREFIXES = [
  "/dashboard",
  "/orders",
  "/customers",
  "/payments",
  "/payroll",
  "/vat",
  "/services",
  "/emails",
  "/users",
  "/config",
  "/huong-dan",
  "/notifications",
  "/expense-approvals",
  "/profile",
  "/pending-approval",
];

function hasControlOrSpace(value: string) {
  return /[\u0000-\u001F\s]/.test(value);
}

function looksExternal(value: string) {
  return (
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    value.startsWith("\\") ||
    value.includes("\\") ||
    value.includes("://") ||
    value.includes("@")
  );
}

/**
 * Same-origin internal path only.
 * Rejects absolute URLs, protocol-relative URLs, backslashes, and routes outside the CRM.
 */
export function safeReturnPath(input: string | null | undefined): string | null {
  if (input == null) return null;
  const raw = String(input).trim();
  if (!raw || raw.length > 512) return null;
  if (!raw.startsWith("/") || looksExternal(raw) || hasControlOrSpace(raw)) return null;

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (looksExternal(decoded) || hasControlOrSpace(decoded)) return null;
  try {
    const twice = decodeURIComponent(decoded);
    if (looksExternal(twice) || hasControlOrSpace(twice)) return null;
  } catch {
    return null;
  }

  let url: URL;
  try {
    url = new URL(raw, "http://crm.internal");
  } catch {
    return null;
  }
  if (url.origin !== "http://crm.internal" || url.username || url.password) return null;
  const path = url.pathname;
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const allowed = INTERNAL_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
  if (!allowed) return null;
  if (url.search.includes("://") || url.search.includes("\\")) return null;
  return `${path}${url.search}`;
}

/** Dashboard is the default. A safe internal path replaces it after a session kick. */
export function pathAfterLogin(user: AuthUser | null | undefined, returnPath: string | null | undefined) {
  const fallback = destinationForUser(user);
  if (fallback !== "/dashboard") return fallback;
  return safeReturnPath(returnPath) ?? fallback;
}

export function rememberReturnPath(path: string | null) {
  if (typeof window === "undefined") return;
  const safe = safeReturnPath(path);
  if (!safe) {
    sessionStorage.removeItem(RETURN_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(RETURN_STORAGE_KEY, safe);
}

export function peekReturnPath(): string | null {
  if (typeof window === "undefined") return null;
  return safeReturnPath(sessionStorage.getItem(RETURN_STORAGE_KEY));
}

export function clearReturnPath() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RETURN_STORAGE_KEY);
}
