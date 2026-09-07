import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiOrder = {
  id: string;
  orderNumber: string;
  contractId: string;
  customerId: string;
  serviceId: string;
  stage: string;
  channel: string;
  collaboratorId: string | null;
  value: string;
  collaboratorPrice: string | null;
  totalNet: string;
  vatRate: string;
  totalGross: string;
  currency: string;
  assignedUserId: string;
  submitterUserId: string;
  reviewerUserId: string | null;
  approvalStatus: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiScheduleLine = {
  id?: string;
  dueDate?: string | null;
  amount: string | number;
  sortOrder?: number;
};

export type CreateOrderBody = {
  orderNumber: string;
  contractId: string;
  customerId: string;
  serviceId: string;
  value: number;
  totalNet: number;
  totalGross: number;
  assignedUserId: string;
  submitterUserId?: string;
  collaboratorId?: string;
  vatRate?: number;
  currency?: string;
  stage?: string;
  notes?: string;
};

export const ordersApi = {
  list(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    return apiRequest<PageResult<ApiOrder>>(`/orders?${params.toString()}`);
  },

  get(id: string) {
    return apiRequest<ApiOrder>(`/orders/${id}`);
  },

  create(body: CreateOrderBody) {
    return apiRequest<ApiOrder>("/orders", { method: "POST", body: JSON.stringify(body) });
  },

  update(
    id: string,
    body: Partial<CreateOrderBody> & {
      notes?: string;
      collaboratorPrice?: number | null;
      channel?: string;
      reviewerUserId?: string | null;
    },
  ) {
    return apiRequest<ApiOrder>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) });
  },

  assign(id: string, assignedUserId: string) {
    return apiRequest<ApiOrder>(`/orders/${id}/assign`, {
      method: "POST",
      body: JSON.stringify({ assignedUserId }),
    });
  },

  changeStage(id: string, stage: string) {
    return apiRequest<ApiOrder>(`/orders/${id}/change-stage`, {
      method: "POST",
      body: JSON.stringify({ stage }),
    });
  },

  approve(id: string, note?: string) {
    return apiRequest<ApiOrder>(`/orders/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ note }),
    });
  },

  listSchedule(orderId: string) {
    return apiRequest<{ items?: ApiScheduleLine[] } | ApiScheduleLine[]>(
      `/orders/${orderId}/payment-schedule`,
    );
  },

  replaceSchedule(orderId: string, lines: ApiScheduleLine[]) {
    return apiRequest(`/orders/${orderId}/payment-schedule`, {
      method: "POST",
      body: JSON.stringify({ lines }),
    });
  },
};
