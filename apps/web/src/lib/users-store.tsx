"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppConfig } from "@/components/providers/antd-provider";
import { loadJson, saveJson } from "@/lib/demo-storage";
import { translateRoleLabel, tt } from "@/lib/i18n";
import { PAGE_PERMISSIONS_CONFIG_KEY, parseConfigValue, persistAndVerifyConfig } from "@/modules/config/api";
import { MOCK_USERS } from "@/lib/mock-users";
import {
  BUILT_IN_ROLES,
  DEFAULT_ROLE_PAGE_PERMISSIONS,
  emptyPagePermissions,
  normalizePagePermissions,
  SYSTEM_PAGES,
  slugifyRoleKey,
  type AppUser,
  type RoleDefinition,
  type RolePagePermissions,
  type SystemPageKey,
  type UserRole,
  type UserStatus,
} from "@/lib/types";

const USERS_KEY = "dny-crm-users";
const ROLE_PERMS_KEY = "dny-crm-role-page-permissions";
const ROLES_KEY = "dny-crm-role-definitions";
const SESSION_KEY = "dny-crm-current-user-id";

const DEFAULT_SESSION_ID = "u2"; // Tran Admin

type UsersContextValue = {
  users: AppUser[];
  roles: RoleDefinition[];
  ready: boolean;
  currentUser: AppUser | null;
  rolePermissions: Record<string, RolePagePermissions>;
  getById: (id: string) => AppUser | undefined;
  getRoleLabel: (roleKey: string) => string;
  getEffectivePermissions: (user: AppUser) => RolePagePermissions;
  createUser: (user: Omit<AppUser, "id" | "createdAt"> & { id?: string }) => AppUser;
  updateUser: (id: string, patch: Partial<AppUser>) => void;
  setUserStatus: (id: string, status: UserStatus) => void;
  updateRolePermissions: (role: UserRole, matrix: RolePagePermissions) => Promise<void>;
  createRole: (label: string, baseRoleKey?: string) => Promise<RoleDefinition>;
  deleteRole: (roleKey: string) => Promise<{ ok: boolean; reason?: string }>;
  loginAs: (userId: string) => void;
  logout: () => void;
  replaceUsers: (items: AppUser[], currentUserId?: string) => void;
  mergeRemoteRoles: (items: RoleDefinition[]) => void;
  hydratePagePermissions: (raw: unknown | null) => void;
};

const UsersContext = createContext<UsersContextValue | null>(null);

function cloneDefaultRolePerms(): Record<string, RolePagePermissions> {
  return structuredClone(DEFAULT_ROLE_PAGE_PERMISSIONS);
}

/** Merge stored matrix; missing page keys fall back to role defaults (not all-false). */
function mergeStoredRoleMatrix(
  role: string,
  stored: Partial<RolePagePermissions>,
): RolePagePermissions {
  const defaults = DEFAULT_ROLE_PAGE_PERMISSIONS[role] ?? emptyPagePermissions();
  const next = emptyPagePermissions();
  for (const page of SYSTEM_PAGES) {
    const key = page.key as SystemPageKey;
    next[key] = stored[key] ?? defaults[key];
  }
  return next;
}

export function UsersProvider({ children }: { children: ReactNode }) {
  const { locale } = useAppConfig();
  const [users, setUsers] = useState<AppUser[]>(MOCK_USERS);
  const [roles, setRoles] = useState<RoleDefinition[]>(BUILT_IN_ROLES);
  const [rolePermissions, setRolePermissions] =
    useState<Record<string, RolePagePermissions>>(cloneDefaultRolePerms);
  const [currentUserId, setCurrentUserId] = useState<string | null>(DEFAULT_SESSION_ID);
  const [ready, setReady] = useState(false);
  const rolePermissionsRef = useRef(rolePermissions);
  rolePermissionsRef.current = rolePermissions;

  useEffect(() => {
    const storedUsers = loadJson<AppUser[]>(USERS_KEY);
    const storedPerms = loadJson<Record<string, RolePagePermissions>>(ROLE_PERMS_KEY);
    const storedRoles = loadJson<RoleDefinition[]>(ROLES_KEY);
    const storedSession = loadJson<string>(SESSION_KEY);
    if (storedUsers?.length) setUsers(storedUsers);
    if (storedPerms) {
      const merged: Record<string, RolePagePermissions> = { ...cloneDefaultRolePerms() };
      for (const [role, matrix] of Object.entries(storedPerms)) {
        merged[role] = mergeStoredRoleMatrix(role, matrix);
      }
      setRolePermissions(merged);
    }
    if (storedRoles?.length) {
      const builtinKeys = new Set(BUILT_IN_ROLES.map((r) => r.key));
      const custom = storedRoles.filter((r) => !builtinKeys.has(r.key));
      setRoles([...BUILT_IN_ROLES, ...custom]);
    }
    if (storedSession) setCurrentUserId(storedSession);
    else setCurrentUserId(DEFAULT_SESSION_ID);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(USERS_KEY, users);
  }, [users, ready]);

  useEffect(() => {
    if (!ready) return;
    saveJson(ROLE_PERMS_KEY, rolePermissions);
  }, [rolePermissions, ready]);

  const persistRolePermissions = useCallback(async (next: Record<string, RolePagePermissions>) => {
    await persistAndVerifyConfig(PAGE_PERMISSIONS_CONFIG_KEY, next);
    setRolePermissions(next);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(ROLES_KEY, roles);
  }, [roles, ready]);

  useEffect(() => {
    if (!ready) return;
    saveJson(SESSION_KEY, currentUserId);
  }, [currentUserId, ready]);

  const currentUser = useMemo(
    () => (currentUserId ? users.find((u) => u.id === currentUserId) ?? null : null),
    [users, currentUserId],
  );

  const getById = useCallback((id: string) => users.find((u) => u.id === id), [users]);

  const getRoleLabel = useCallback(
    (roleKey: string) => {
      const stored = roles.find((r) => r.key === roleKey)?.label;
      return translateRoleLabel(roleKey, stored);
    },
    [roles, locale],
  );

  const getEffectivePermissions = useCallback(
    (user: AppUser): RolePagePermissions => {
      if (user.useCustomPermissions && user.customPermissions) {
        return normalizePagePermissions(user.customPermissions);
      }
      return mergeStoredRoleMatrix(user.role, rolePermissions[user.role] ?? {});
    },
    [rolePermissions],
  );

  const createUser = useCallback(
    (input: Omit<AppUser, "id" | "createdAt"> & { id?: string }) => {
      const newUser: AppUser = {
        ...input,
        id: input.id ?? `u${Date.now()}`,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setUsers((prev) => [...prev, newUser]);
      return newUser;
    },
    [],
  );

  const updateUser = useCallback((id: string, patch: Partial<AppUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
  }, []);

  const setUserStatus = useCallback((id: string, status: UserStatus) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status } : u)));
  }, []);

  const updateRolePermissions = useCallback(
    async (role: UserRole, matrix: RolePagePermissions) => {
      const next = { ...rolePermissionsRef.current, [role]: matrix };
      await persistRolePermissions(next);
    },
    [persistRolePermissions],
  );

  const createRole = useCallback(
    async (label: string, baseRoleKey?: string) => {
      const trimmed = label.trim();
      const current = rolePermissionsRef.current;
      const existingKeys = new Set([...roles.map((r) => r.key), ...Object.keys(current)]);
      let finalKey = slugifyRoleKey(trimmed);
      let n = 2;
      while (existingKeys.has(finalKey)) {
        finalKey = `${slugifyRoleKey(trimmed)}_${n++}`;
      }
      const def = { key: finalKey, label: trimmed, builtin: false as const };
      const base =
        (baseRoleKey && current[baseRoleKey]) || current.staff || emptyPagePermissions();
      const next = { ...current, [finalKey]: structuredClone(base) };
      setRoles((prev) => [...prev, def]);
      try {
        await persistRolePermissions(next);
      } catch (err) {
        setRoles((prev) => prev.filter((r) => r.key !== def.key));
        throw err;
      }
      return def;
    },
    [persistRolePermissions, roles],
  );

  const deleteRole = useCallback(
    async (roleKey: string) => {
      const def = roles.find((r) => r.key === roleKey);
      if (!def) return { ok: false, reason: tt("user.roleNotFound") };
      if (def.builtin) return { ok: false, reason: tt("user.cannotDeleteBuiltin") };
      const inUse = users.some((u) => u.role === roleKey);
      if (inUse) {
        return { ok: false, reason: tt("user.roleInUse") };
      }
      const prevRoles = roles;
      const next = { ...rolePermissionsRef.current };
      delete next[roleKey];
      setRoles((prev) => prev.filter((r) => r.key !== roleKey));
      try {
        await persistRolePermissions(next);
      } catch (err) {
        setRoles(prevRoles);
        throw err;
      }
      return { ok: true };
    },
    [persistRolePermissions, roles, users],
  );

  const loginAs = useCallback((userId: string) => {
    setCurrentUserId(userId);
  }, []);

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const replaceUsers = useCallback((items: AppUser[], currentUserId?: string) => {
    setUsers(items);
    if (currentUserId) setCurrentUserId(currentUserId);
  }, []);

  const mergeRemoteRoles = useCallback((items: RoleDefinition[]) => {
    const extras = items.filter((r) => !r.builtin && !BUILT_IN_ROLES.some((b) => b.key === r.key));
    setRoles([...BUILT_IN_ROLES, ...extras]);
  }, []);

  const hydratePagePermissions = useCallback((raw: unknown | null) => {
    const parsed = parseConfigValue(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length > 0) {
      const merged: Record<string, RolePagePermissions> = { ...cloneDefaultRolePerms() };
      for (const [role, matrix] of Object.entries(parsed as Record<string, Partial<RolePagePermissions>>)) {
        if (matrix && typeof matrix === "object") {
          merged[role] = mergeStoredRoleMatrix(role, matrix);
        }
      }
      setRolePermissions(merged);
    }
  }, []);

  const value = useMemo(
    () => ({
      users,
      roles,
      ready,
      currentUser,
      rolePermissions,
      getById,
      getRoleLabel,
      getEffectivePermissions,
      createUser,
      updateUser,
      setUserStatus,
      updateRolePermissions,
      createRole,
      deleteRole,
      loginAs,
      logout,
      replaceUsers,
      mergeRemoteRoles,
      hydratePagePermissions,
    }),
    [
      users,
      roles,
      ready,
      currentUser,
      rolePermissions,
      getById,
      getRoleLabel,
      getEffectivePermissions,
      createUser,
      updateUser,
      setUserStatus,
      updateRolePermissions,
      createRole,
      deleteRole,
      loginAs,
      logout,
      replaceUsers,
      mergeRemoteRoles,
      hydratePagePermissions,
    ],
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used within UsersProvider");
  return ctx;
}
