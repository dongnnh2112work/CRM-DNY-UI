import { loadJson, saveJson } from "@/lib/demo-storage";
import type { AuthUser } from "@/modules/auth/api";

const AUTH_USER_KEY = "dyn-crm-auth-user";
const LEGACY_SNAPSHOT_KEY = "dyn-crm-hydrate-v1";

function dropLegacySnapshot() {
  try {
    localStorage.removeItem(LEGACY_SNAPSHOT_KEY);
  } catch {
    /* ignore */
  }
}

export function readCachedAuthUser(): AuthUser | null {
  dropLegacySnapshot();
  const user = loadJson<AuthUser>(AUTH_USER_KEY);
  if (!user?.id) return null;
  return user;
}

export function writeCachedAuthUser(user: AuthUser) {
  saveJson(AUTH_USER_KEY, user);
}

export function clearClientCaches() {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
    dropLegacySnapshot();
  } catch {
    /* ignore quota / private mode */
  }
}
