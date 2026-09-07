import type { AppUser, RoleDefinition, UserRole, UserStatus } from "@/lib/types";
import type { AuthUser } from "@/modules/auth/api";
import type { IdentityRole, IdentityUser } from "@/modules/identity-admin/api";

const BUILTIN_KEYS = new Set(["super_admin", "admin", "accountant", "staff", "ctv_role"]);

export function mapApiRoleCodeToUi(code: string): UserRole {
  const c = code.toUpperCase();
  if (c === "SUPER_ADMIN") return "super_admin";
  if (c === "ADMIN") return "admin";
  if (c === "ACCOUNTANT") return "accountant";
  if (c.includes("CTV") || c.includes("COLLAB")) return "ctv_role";
  if (c === "SALES" || c === "STAFF") return "staff";
  return code.toLowerCase();
}

export function uiRoleToApiCodes(role: UserRole): string[] {
  const map: Record<string, string> = {
    super_admin: "SUPER_ADMIN",
    admin: "ADMIN",
    accountant: "ACCOUNTANT",
    staff: "SALES",
    ctv_role: "CTV",
  };
  return [map[role] ?? String(role).toUpperCase()];
}

export function uiStatusToApi(status: UserStatus | undefined): "ACTIVE" | "SUSPENDED" {
  return status === "inactive" ? "SUSPENDED" : "ACTIVE";
}

function mapRole(codes: string[] | undefined): UserRole {
  const c = (codes ?? []).map((x) => x.toUpperCase());
  if (c.includes("SUPER_ADMIN")) return "super_admin";
  if (c.includes("ADMIN")) return "admin";
  if (c.includes("ACCOUNTANT")) return "accountant";
  if (c.some((x) => x.includes("CTV") || x.includes("COLLAB"))) return "ctv_role";
  return "staff";
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
