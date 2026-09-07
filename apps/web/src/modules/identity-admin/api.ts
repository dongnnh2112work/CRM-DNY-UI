import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type IdentityUser = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  phone?: string | null;
  roleCodes?: string[];
  createdAt?: string;
};

export type IdentityRole = {
  id: string;
  code: string;
  name: string;
};

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

  listRoles() {
    return apiRequest<PageResult<IdentityRole> | IdentityRole[]>("/roles");
  },

  createRole(body: { code: string; name: string }) {
    return apiRequest<IdentityRole>("/roles", { method: "POST", body: JSON.stringify(body) });
  },
};
