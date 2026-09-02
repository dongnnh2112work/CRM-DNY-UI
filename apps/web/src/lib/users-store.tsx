"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppConfig } from "@/components/providers/antd-provider";
import { loadJson, saveJson } from "@/lib/demo-storage";
import { translateRoleLabel, tt } from "@/lib/i18n";
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
  updateRolePermissions: (role: UserRole, matrix: RolePagePermissions) => void;
  createRole: (label: string, baseRoleKey?: string) => RoleDefinition;
  deleteRole: (roleKey: string) => { ok: boolean; reason?: string };
  loginAs: (userId: string) => void;
  logout: () => void;
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

  const updateRolePermissions = useCallback((role: UserRole, matrix: RolePagePermissions) => {
    setRolePermissions((prev) => ({ ...prev, [role]: matrix }));
  }, []);

  const createRole = useCallback(
    (label: string, baseRoleKey?: string) => {
      const trimmed = label.trim();
      const existingKeys = new Set([...roles.map((r) => r.key), ...Object.keys(rolePermissions)]);
      let finalKey = slugifyRoleKey(trimmed);
      let n = 2;
      while (existingKeys.has(finalKey)) {
        finalKey = `${slugifyRoleKey(trimmed)}_${n++}`;
      }
      const def = { key: finalKey, label: trimmed, builtin: false as const };
      const base =
        (baseRoleKey && rolePermissions[baseRoleKey]) ||
        rolePermissions.staff ||
        emptyPagePermissions();
      setRoles((prev) => [...prev, def]);
      setRolePermissions((prev) => ({ ...prev, [finalKey]: structuredClone(base) }));
      return def;
    },
    [rolePermissions, roles],
  );

  const deleteRole = useCallback(
    (roleKey: string) => {
      const def = roles.find((r) => r.key === roleKey);
      if (!def) return { ok: false, reason: tt("user.roleNotFound") };
      if (def.builtin) return { ok: false, reason: tt("user.cannotDeleteBuiltin") };
      const inUse = users.some((u) => u.role === roleKey);
      if (inUse) {
        return { ok: false, reason: tt("user.roleInUse") };
      }
      setRoles((prev) => prev.filter((r) => r.key !== roleKey));
      setRolePermissions((prev) => {
        const next = { ...prev };
        delete next[roleKey];
        return next;
      });
      return { ok: true };
    },
    [roles, users],
  );

  const loginAs = useCallback((userId: string) => {
    setCurrentUserId(userId);
  }, []);

  const logout = useCallback(() => {
    setCurrentUserId(null);
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
    ],
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error("useUsers must be used within UsersProvider");
  return ctx;
}
