import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiService = {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  category: string | null;
  unitPrice: string | null;
  processingDays: number | null;
  status: string;
  customFields: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateServiceBody = {
  name: string;
  code?: string;
  description?: string;
  category?: string;
  unitPrice?: number;
  processingDays?: number;
  status?: string;
  customFields?: Record<string, unknown>;
};

export const servicesApi = {
  list(query: { page?: number; pageSize?: number; search?: string; status?: string; category?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.status) params.set("status", query.status);
    if (query.category) params.set("category", query.category);
    return apiRequest<PageResult<ApiService>>(`/services?${params.toString()}`);
  },

  get(id: string) {
    return apiRequest<ApiService>(`/services/${id}`);
  },

  create(body: CreateServiceBody) {
    return apiRequest<ApiService>("/services", { method: "POST", body: JSON.stringify(body) });
  },

  update(id: string, body: Partial<CreateServiceBody>) {
    return apiRequest<ApiService>(`/services/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },

  archive(id: string) {
    return apiRequest<ApiService>(`/services/${id}/archive`, { method: "POST" });
  },
};
