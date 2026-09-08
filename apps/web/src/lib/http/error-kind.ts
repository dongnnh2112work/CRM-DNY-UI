import { ApiError } from "@/lib/http/errors";

export type ApiErrorKind = "unauthorized" | "forbidden" | "blocked" | "server" | "network" | "unknown";
export type OAuthErrorKind = "oauth_denied" | "oauth_failed" | "oauth_invalid";

export function isBlockedAccountError(err: ApiError) {
  const text = err.messages.join(" ").toUpperCase();
  return text.includes("SUSPENDED") || text.includes("DEACTIVATED");
}

export function classifyApiError(err: unknown): ApiErrorKind {
  if (err instanceof TypeError) return "network";
  if (!(err instanceof ApiError)) return "unknown";
  if (isBlockedAccountError(err)) return "blocked";
  if (err.isUnauthorized) return "unauthorized";
  if (err.isForbidden) return "forbidden";
  if (err.statusCode >= 500) return "server";
  return "unknown";
}

export function classifyOAuthError(error: string | null, description: string | null): OAuthErrorKind {
  const code = (error ?? "").toLowerCase();
  if (code === "access_denied") return "oauth_denied";
  if (!error && !description) return "oauth_invalid";
  return "oauth_failed";
}

/** Only for GET /auth/me: 403 means token exists but CRM access is not granted yet. */
export function isPendingMeError(err: unknown): boolean {
  if (!(err instanceof ApiError)) return false;
  const text = err.messages.join(" ").toUpperCase();
  if (text.includes("PENDING_APPROVAL") || text.includes("WAITING_APPROVAL") || text.includes("INVITED")) {
    return true;
  }
  return err.isForbidden;
}

export function placeholderPendingUser(email = ""): {
  id: string;
  email: string;
  displayName: string;
  status: string;
  permissions: string[];
  roleCodes: string[];
} {
  return {
    id: "pending-local",
    email,
    displayName: email || "",
    status: "PENDING_APPROVAL",
    permissions: [],
    roleCodes: [],
  };
}
