import type { AuthUser } from "@/modules/auth/api";

const PENDING_STATUS = new Set(["INVITED", "PENDING_APPROVAL", "PENDING", "WAITING_APPROVAL"]);
const BLOCKED_STATUS = new Set(["SUSPENDED", "DEACTIVATED"]);

export type AccessGate = "ok" | "pending" | "blocked";

export function userStatus(user: AuthUser | null | undefined) {
  return (user?.status ?? "").toUpperCase();
}

export function isPendingStatus(status: string | null | undefined) {
  return PENDING_STATUS.has((status ?? "").toUpperCase());
}

export function isBlockedStatus(status: string | null | undefined) {
  return BLOCKED_STATUS.has((status ?? "").toUpperCase());
}

/** Product rule: ACTIVE + at least one role + at least one permission. */
export function canEnterCrm(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return (
    userStatus(user) === "ACTIVE" &&
    (user.roleCodes?.length ?? 0) > 0 &&
    (user.permissions?.length ?? 0) > 0
  );
}

export function accessGate(user: AuthUser | null | undefined): AccessGate {
  if (!user) return "pending";
  if (isBlockedStatus(user.status)) return "blocked";
  if (isPendingStatus(user.status)) return "pending";
  if ((user.roleCodes?.length ?? 0) === 0 && (user.permissions?.length ?? 0) === 0) return "pending";
  if (!canEnterCrm(user)) return "pending";
  return "ok";
}

export function isAwaitingAccess(user: AuthUser | null | undefined) {
  const gate = accessGate(user);
  return gate === "pending" || gate === "blocked";
}

export function destinationForUser(user: AuthUser | null | undefined) {
  return accessGate(user) === "ok" ? "/dashboard" : "/pending-approval";
}
