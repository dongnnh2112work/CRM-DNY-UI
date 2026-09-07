import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type CommissionStatus = "PENDING" | "CALCULATED" | "APPROVED" | "PAID" | "CANCELLED";

export type ApiCommission = {
  id: string;
  orderId: string;
  paymentId: string | null;
  collaboratorId: string | null;
  beneficiaryUserId: string | null;
  rate: string;
  baseAmount: string;
  commissionAmount: string;
  periodStart: string;
  periodEnd: string;
  status: CommissionStatus;
  calculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const commissionsApi = {
  list(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    return apiRequest<PageResult<ApiCommission>>(`/commissions?${params.toString()}`);
  },

  get(id: string) {
    return apiRequest<ApiCommission>(`/commissions/${id}`);
  },

  create(body: {
    orderId: string;
    rate: number;
    baseAmount: number;
    periodStart: string;
    periodEnd: string;
    paymentId?: string;
    collaboratorId?: string;
    beneficiaryUserId?: string;
  }) {
    return apiRequest<ApiCommission>("/commissions", { method: "POST", body: JSON.stringify(body) });
  },

  calculate(id: string, body: { rate: number; baseAmount: number }) {
    return apiRequest<ApiCommission>(`/commissions/${id}/calculate`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  approve(id: string) {
    return apiRequest<ApiCommission>(`/commissions/${id}/approve`, { method: "POST" });
  },

  pay(id: string) {
    return apiRequest<ApiCommission>(`/commissions/${id}/pay`, { method: "POST" });
  },
};
