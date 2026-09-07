import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiExpense = {
  id: string;
  orderId: string;
  title: string;
  amount: string;
  currency: string;
  note: string | null;
  payeeName: string | null;
  description: string | null;
  incurredOn: string | null;
  ctvRelated: boolean;
  status: string;
  requestedByUserId: string;
  requestedAt: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export const expensesApi = {
  list(query: { page?: number; pageSize?: number; orderId?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.orderId) params.set("orderId", query.orderId);
    return apiRequest<PageResult<ApiExpense>>(`/expenses?${params.toString()}`);
  },

  create(body: {
    orderId: string;
    title: string;
    amount: number;
    currency?: string;
    note?: string;
    payeeName?: string;
    description?: string;
    incurredOn?: string;
    ctvRelated?: boolean;
  }) {
    return apiRequest<ApiExpense>("/expenses", { method: "POST", body: JSON.stringify(body) });
  },

  approve(id: string, note?: string) {
    return apiRequest<ApiExpense>(`/expenses/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
  },

  reject(id: string, note?: string) {
    return apiRequest<ApiExpense>(`/expenses/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
  },
};
