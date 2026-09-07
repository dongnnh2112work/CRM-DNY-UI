import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "QR_PAYMENT";
export type PaymentVerificationStatus = "RECORDED" | "VERIFIED" | "VOIDED";

export type ApiPayment = {
  id: string;
  orderId: string;
  scheduleLineId: string | null;
  amount: string;
  method: PaymentMethod;
  recordedAt: string;
  verificationStatus: PaymentVerificationStatus;
  createdAt: string;
  updatedAt: string;
};

export const paymentsApi = {
  list(query: { page?: number; pageSize?: number; orderId?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    if (query.orderId) params.set("orderId", query.orderId);
    return apiRequest<PageResult<ApiPayment>>(`/payments?${params.toString()}`);
  },

  get(id: string) {
    return apiRequest<ApiPayment>(`/payments/${id}`);
  },

  create(body: { orderId: string; amount: number; method: PaymentMethod; scheduleLineId?: string }) {
    return apiRequest<ApiPayment>("/payments", { method: "POST", body: JSON.stringify(body) });
  },

  verify(id: string) {
    return apiRequest<ApiPayment>(`/payments/${id}/verify`, { method: "POST" });
  },

  void(id: string) {
    return apiRequest<ApiPayment>(`/payments/${id}/void`, { method: "POST" });
  },
};
