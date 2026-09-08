import type { AuthUser } from "@/modules/auth/api";

const PENDING_STATUS = new Set(["INVITED", "PENDING_APPROVAL", "PENDING", "WAITING_APPROVAL"]);
const BLOCKED_STATUS = new Set(["SUSPENDED", "DEACTIVATED"]);

export type AccessGate = "ok" | "pending" | "blocked";

/** Google / new users wait until admin assigns roles. Password users with roles pass. */
export function accessGate(user: AuthUser | null | undefined): AccessGate {
  if (!user) return "ok";
  const status = (user.status ?? "").toUpperCase();
  if (BLOCKED_STATUS.has(status)) return "blocked";
  if (PENDING_STATUS.has(status)) return "pending";
  const roles = (user.roleCodes ?? []).map((r) => r.toUpperCase());
  const isAdmin = roles.some((r) => r === "ADMIN" || r === "SUPER_ADMIN");
  if (!isAdmin && roles.length === 0 && (user.permissions?.length ?? 0) === 0) return "pending";
  return "ok";
}

export function isAwaitingAccess(user: AuthUser | null | undefined) {
  const gate = accessGate(user);
  return gate === "pending" || gate === "blocked";
}
