import type { AppUser, RoleDefinition, UserRole, UserStatus } from "@/lib/types";
import type { AuthUser } from "@/modules/auth/api";
import type {
  IdentityPermissionGroup,
  IdentityRole,
  IdentityUser,
} from "@/modules/identity-admin/api";

const BUILTIN_KEYS = new Set(["super_admin", "admin", "accountant", "staff", "ctv_role"]);

export function mapApiRoleCodeToUi(code: string): UserRole {
  const c = code.toUpperCase();
  if (c === "SUPER_ADMIN") return "super_admin";
  if (c === "ADMIN") return "admin";
  if (c === "ACCOUNTANT" || c === "ACCOUNTING") return "accountant";
  if (c.includes("CTV") || c.includes("COLLAB")) return "ctv_role";
  if (c === "SALES" || c === "STAFF") return "staff";
  if (c === "MANAGER") return "manager";
  if (c === "LAWYER") return "lawyer";
  if (c === "LEGAL_ASSISTANT") return "legal_assistant";
  return code.toLowerCase();
}

/** Primary API role code to send on PUT /users/:id/roles. */
export function uiRoleToApiCodes(role: UserRole): string[] {
  const map: Record<string, string> = {
    super_admin: "SUPER_ADMIN",
    admin: "ADMIN",
    accountant: "ACCOUNTING",
    staff: "SALES",
    ctv_role: "COLLABORATOR",
    manager: "MANAGER",
    lawyer: "LAWYER",
    legal_assistant: "LEGAL_ASSISTANT",
  };
  return [map[role] ?? String(role).toUpperCase()];
}

const UI_ROLE_API_ALIASES: Record<string, string[]> = {
  super_admin: ["SUPER_ADMIN"],
  admin: ["ADMIN"],
  accountant: ["ACCOUNTING", "ACCOUNTANT"],
  staff: ["SALES", "STAFF"],
  ctv_role: ["COLLABORATOR", "CTV"],
  manager: ["MANAGER"],
  lawyer: ["LAWYER"],
  legal_assistant: ["LEGAL_ASSISTANT"],
};

export function apiCodesForUiRole(uiKey: string): string[] {
  return UI_ROLE_API_ALIASES[uiKey] ?? uiRoleToApiCodes(uiKey);
}

export function findIdentityRoleForUi(roles: IdentityRole[], uiKey: string): IdentityRole | undefined {
  const aliases = apiCodesForUiRole(uiKey).map((c) => c.toUpperCase());
  return (
    roles.find((r) => aliases.includes(r.code.toUpperCase())) ??
    roles.find((r) => mapApiRoleCodeToUi(r.code) === uiKey)
  );
}

export function userHasApiRole(user: Pick<IdentityUser, "roleCodes">, codes: string[]): boolean {
  const aliases = new Set(codes.map((c) => c.toUpperCase()));
  return (user.roleCodes ?? []).some((code) => aliases.has(code.toUpperCase()));
}

export function roleCodesEqual(a: string[] | undefined, b: string[] | undefined): boolean {
  const left = [...(a ?? [])].map((c) => c.toUpperCase()).sort();
  const right = [...(b ?? [])].map((c) => c.toUpperCase()).sort();
  return left.length === right.length && left.every((code, i) => code === right[i]);
}

export function unwrapIdentityEntity<T extends object>(raw: unknown): T | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as { data?: unknown };
  if (obj.data && typeof obj.data === "object" && !Array.isArray(obj.data)) {
    return obj.data as T;
  }
  return raw as T;
}

export function permissionCodesOf(group: IdentityPermissionGroup): string[] {
  return (group.permissions ?? [])
    .map((item) => (typeof item === "string" ? item : item.code))
    .filter(Boolean);
}

export function roleHasGroupField(role: IdentityRole | undefined | null): boolean {
  if (!role) return false;
  return Array.isArray(role.permissionGroupCodes) || Array.isArray(role.permissionGroups);
}

export function roleGroupCodes(role: IdentityRole | undefined | null): string[] {
  if (!role) return [];
  if (role.permissionGroupCodes?.length) return [...role.permissionGroupCodes];
  if (role.permissionGroups?.length) return role.permissionGroups.map((g) => g.code);
  return [];
}

export function uiStatusToApi(status: UserStatus | undefined): "ACTIVE" | "SUSPENDED" {
  return status === "inactive" ? "SUSPENDED" : "ACTIVE";
}

function mapRole(codes: string[] | undefined): UserRole {
  const list = codes ?? [];
  if (!list.length) return "staff";
  const priority = [
    "SUPER_ADMIN",
    "ADMIN",
    "MANAGER",
    "ACCOUNTING",
    "ACCOUNTANT",
    "LAWYER",
    "LEGAL_ASSISTANT",
    "COLLABORATOR",
    "CTV",
    "SALES",
    "STAFF",
  ];
  const upper = list.map((x) => x.toUpperCase());
  for (const code of priority) {
    if (upper.includes(code)) return mapApiRoleCodeToUi(code);
  }
  return mapApiRoleCodeToUi(list[0]);
}

function mapStatus(status: string | undefined): UserStatus {
  const s = (status ?? "").toUpperCase();
  return s === "ACTIVE" || s === "INVITED" ? "active" : "inactive";
}

export function mapIdentityUserToUi(u: IdentityUser): AppUser {
  return {
    id: u.id,
    name: u.displayName || u.email,
    email: u.email,
    phone: u.phone ?? undefined,
    role: mapRole(u.roleCodes),
    roleCodes: u.roleCodes?.length ? [...u.roleCodes] : undefined,
    status: mapStatus(u.status),
    authMethod: "email",
    createdAt: u.createdAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  };
}

export function mapAuthUserToUi(u: AuthUser): AppUser {
  return {
    id: u.id,
    name: u.displayName || u.email,
    email: u.email,
    role: mapRole(u.roleCodes),
    roleCodes: u.roleCodes?.length ? [...u.roleCodes] : undefined,
    status: mapStatus(u.status),
    authMethod: "email",
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

export function mapIdentityRoleToUi(r: IdentityRole): RoleDefinition {
  const key = mapApiRoleCodeToUi(r.code);
  return {
    key,
    label: r.name || r.code,
    builtin: BUILTIN_KEYS.has(key),
  };
}
