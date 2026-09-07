import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiCollaborator = {
  id: string;
  userId: string;
  displayName: string;
  phone: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export const collaboratorsApi = {
  list(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    return apiRequest<PageResult<ApiCollaborator>>(`/collaborators?${params.toString()}`);
  },

  create(body: { userId: string; displayName: string; phone?: string; email?: string; notes?: string }) {
    return apiRequest<ApiCollaborator>("/collaborators", { method: "POST", body: JSON.stringify(body) });
  },

  update(id: string, body: Partial<{ displayName: string; phone: string; email: string; notes: string }>) {
    return apiRequest<ApiCollaborator>(`/collaborators/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },

  deactivate(id: string) {
    return apiRequest<ApiCollaborator>(`/collaborators/${id}/deactivate`, { method: "POST" });
  },
};
