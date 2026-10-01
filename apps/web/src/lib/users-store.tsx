"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppConfig } from "@/components/providers/antd-provider";
import { translateRoleLabel, tt } from "@/lib/i18n";
import { PAGE_PERMISSIONS_CONFIG_KEY, parseConfigValue, persistAndVerifyConfig } from "@/modules/config/api";
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
  /** Seed the auth/me user when /users is not loaded (no user.manage). */
  ensureSessionUser: (sessionUser: AppUser) => void;
  mergeRemoteRoles: (items: RoleDefinition[]) => void;
  hydratePagePermissions: (raw: unknown | null) => void;
  resetServerData: () => void;
};

const UsersContext = createContext<UsersContextValue | null>(null);

function cloneDefaultRolePerms(): Record<string, RolePagePermissions> {
  return structuredClone(DEFAULT_ROLE_PAGE_PERMISSIONS);
}

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
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>(BUILT_IN_ROLES);
  const [rolePermissions, setRolePermissions] =
    useState<Record<string, RolePagePermissions>>(cloneDefaultRolePerms);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const rolePermissionsRef = useRef(rolePermissions);
  rolePermissionsRef.current = rolePermissions;

  const persistRolePermissions = useCallback(async (next: Record<string, RolePagePermissions>) => {
    await persistAndVerifyConfig(PAGE_PERMISSIONS_CONFIG_KEY, next);
    setRolePermissions(next);
  }, []);

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
    [persistRolePermissions, roles],
  );

  const loginAs = useCallback((userId: string) => {
    setCurrentUserId(userId);
  }, []);

  const logout = useCallback(() => {
    setCurrentUserId(null);
  }, []);

  const replaceUsers = useCallback((items: AppUser[], nextCurrentUserId?: string) => {
    setUsers(items);
    if (nextCurrentUserId) setCurrentUserId(nextCurrentUserId);
  }, []);

  /** Ensure the logged-in auth user exists in-store without loading /users. */
  const ensureSessionUser = useCallback((sessionUser: AppUser) => {
    setUsers((prev) => {
      if (prev.some((u) => u.id === sessionUser.id)) return prev;
      return [sessionUser, ...prev];
    });
    setCurrentUserId((prev) => prev ?? sessionUser.id);
  }, []);

  const mergeRemoteRoles = useCallback((items: RoleDefinition[]) => {
    const byKey = new Map<string, RoleDefinition>();
    for (const role of BUILT_IN_ROLES) byKey.set(role.key, role);
    for (const role of items) {
      const existing = byKey.get(role.key);
      if (existing?.builtin) {
        byKey.set(role.key, { ...existing, label: role.label || existing.label });
      } else {
        byKey.set(role.key, role);
      }
    }
    setRoles([...byKey.values()]);
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

  const resetServerData = useCallback(() => {
    setUsers([]);
    setRoles(BUILT_IN_ROLES);
    setRolePermissions(cloneDefaultRolePerms());
    setCurrentUserId(null);
  }, []);

  const value = useMemo(
    () => ({
      users,
      roles,
      ready: true,
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
      ensureSessionUser,
      mergeRemoteRoles,
      hydratePagePermissions,
      resetServerData,
    }),
    [
      users,
      roles,
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
      ensureSessionUser,
      mergeRemoteRoles,
      hydratePagePermissions,
      resetServerData,
    ],
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used within UsersProvider");
  return ctx;
}
