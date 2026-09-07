import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiContract = {
  id: string;
  contractNumber: string;
  customerId: string;
  status: string;
  title: string | null;
  description: string | null;
  signedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const contractsApi = {
  list(query: { page?: number; pageSize?: number; search?: string; customerId?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.customerId) params.set("customerId", query.customerId);
    return apiRequest<PageResult<ApiContract>>(`/contracts?${params.toString()}`);
  },

  create(body: { contractNumber: string; customerId: string; title?: string; description?: string }) {
    return apiRequest<ApiContract>("/contracts", { method: "POST", body: JSON.stringify(body) });
  },

  update(id: string, body: Partial<{ contractNumber: string; customerId: string; title: string; description: string }>) {
    return apiRequest<ApiContract>(`/contracts/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },
};
