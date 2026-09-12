import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

function unwrapPage<T>(raw: unknown): PageResult<T> | T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (!raw || typeof raw !== "object") return [];
  const obj = raw as {
    items?: T[];
    data?: T[] | { items?: T[]; total?: number; page?: number; pageSize?: number };
    total?: number;
    page?: number;
    pageSize?: number;
  };
  if (Array.isArray(obj.items)) return obj as PageResult<T>;
  if (Array.isArray(obj.data)) return obj.data;
  if (obj.data && typeof obj.data === "object" && Array.isArray(obj.data.items)) {
    return obj.data as PageResult<T>;
  }
  return [];
}

export type IdentityUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  phone?: string | null;
  roleCodes?: string[];
  createdAt?: string;
};

export type IdentityPermission = {
  id?: string;
  code: string;
  description?: string;
};

export type IdentityPermissionGroup = {
  id: string;
  code: string;
  name: string;
  permissions?: Array<string | IdentityPermission>;
};

export type IdentityRole = {
  id: string;
  code: string;
  name: string;
  permissionGroupCodes?: string[];
  permissionGroups?: IdentityPermissionGroup[];
};

export const APPROVAL_ROLE_CODES = [
  "SALES",
  "MANAGER",
  "LAWYER",
  "LEGAL_ASSISTANT",
  "ACCOUNTING",
  "ADMIN",
  "SUPER_ADMIN",
  "COLLABORATOR",
] as const;

export type ApprovalRoleCode = (typeof APPROVAL_ROLE_CODES)[number];

export const identityAdminApi = {
  listUsers(query: { page?: number; pageSize?: number; search?: string; status?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.status) params.set("status", query.status);
    return apiRequest<PageResult<IdentityUser>>(`/users?${params.toString()}`);
  },

  getUser(id: string) {
    return apiRequest<IdentityUser>(`/users/${id}`);
  },

  createUser(body: {
    email: string;
    displayName: string;
    status?: string;
    roleCodes?: string[];
    phone?: string;
  }) {
    return apiRequest<IdentityUser>("/users", { method: "POST", body: JSON.stringify(body) });
  },

  updateUser(id: string, body: Partial<{ displayName: string; status: string; phone: string }>) {
    return apiRequest<IdentityUser>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },

  removeUser(id: string) {
    return apiRequest<void>(`/users/${id}`, { method: "DELETE" });
  },

  setUserRoles(id: string, roleCodes: string[]) {
    return apiRequest<IdentityUser>(`/users/${id}/roles`, {
      method: "PUT",
      body: JSON.stringify({ roleCodes }),
    });
  },

  listRoles(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    if (query.page != null) params.set("page", String(query.page));
    if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
    const q = params.toString();
    return apiRequest<PageResult<IdentityRole> | IdentityRole[]>(q ? `/roles?${q}` : "/roles").then(
      (raw) => unwrapPage<IdentityRole>(raw),
    );
  },

  getRole(id: string) {
    return apiRequest<IdentityRole>(`/roles/${id}`);
  },

  createRole(body: { code: string; name: string }) {
    return apiRequest<IdentityRole>("/roles", { method: "POST", body: JSON.stringify(body) });
  },

  setRolePermissionGroups(id: string, permissionGroupCodes: string[]) {
    return apiRequest<IdentityRole>(`/roles/${id}/permission-groups`, {
      method: "PUT",
      body: JSON.stringify({ permissionGroupCodes }),
    });
  },

  listPermissionGroups(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    if (query.page != null) params.set("page", String(query.page));
    if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
    const q = params.toString();
    return apiRequest<PageResult<IdentityPermissionGroup> | IdentityPermissionGroup[]>(
      q ? `/permission-groups?${q}` : "/permission-groups",
    ).then((raw) => unwrapPage<IdentityPermissionGroup>(raw));
  },

  getPermissionGroup(id: string) {
    return apiRequest<IdentityPermissionGroup>(`/permission-groups/${id}`);
  },

  createPermissionGroup(body: { code: string; name: string }) {
    return apiRequest<IdentityPermissionGroup>("/permission-groups", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  setGroupPermissions(id: string, permissionCodes: string[]) {
    return apiRequest<IdentityPermissionGroup>(`/permission-groups/${id}/permissions`, {
      method: "PUT",
      body: JSON.stringify({ permissionCodes }),
    });
  },

  listPermissions(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    if (query.page != null) params.set("page", String(query.page));
    if (query.pageSize != null) params.set("pageSize", String(query.pageSize));
    const q = params.toString();
    return apiRequest<PageResult<IdentityPermission> | IdentityPermission[]>(
      q ? `/permissions?${q}` : "/permissions",
    ).then((raw) => unwrapPage<IdentityPermission>(raw));
  },
};
