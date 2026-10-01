import type { AuthUser } from "@/modules/auth/api";

/**
 * In-memory only — never persisted. Used for pending-session checks in the
 * HTTP client and cleared on logout / account switch.
 */
let lastKnownAuthUser: AuthUser | null = null;

export function setLastKnownAuthUser(user: AuthUser | null) {
  lastKnownAuthUser = user;
}

export function getLastKnownAuthUser(): AuthUser | null {
  return lastKnownAuthUser;
}

const AUTH_USER_KEY = "dyn-crm-auth-user";
const LEGACY_SNAPSHOT_KEY = "dyn-crm-hydrate-v1";
const USERS_KEY = "dny-crm-users";
const ROLE_PERMS_KEY = "dny-crm-role-page-permissions";
const ROLES_KEY = "dny-crm-role-definitions";
const SESSION_KEY = "dny-crm-current-user-id";
const ORDER_STAGE_KEY = "dny-crm-order-stage-meta";
const CUSTOMER_STATUS_KEY = "dny-crm-customer-status-meta";
const REMINDERS_KEY = "dny-crm-app-reminders";

const SERVER_CACHE_KEYS = [
  AUTH_USER_KEY,
  LEGACY_SNAPSHOT_KEY,
  USERS_KEY,
  ROLE_PERMS_KEY,
  ROLES_KEY,
  SESSION_KEY,
  ORDER_STAGE_KEY,
  CUSTOMER_STATUS_KEY,
  REMINDERS_KEY,
] as const;

/** Drop every persisted server-side snapshot. UI prefs (columns, etc.) stay. */
export function purgePersistedServerCaches() {
  try {
    for (const key of SERVER_CACHE_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearClientCaches() {
  lastKnownAuthUser = null;
  purgePersistedServerCaches();
}
