import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";
import type { ApiDocument } from "@/modules/documents/api";
import type { ApiExpense } from "@/modules/expenses/api";
import type { ApiPayment } from "@/modules/payments/api";

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
  /** BE batch-JOIN on list/detail (2026-10-06). */
  assignedUserName?: string | null;
  submitterUserId: string;
  submitterName?: string | null;
  reviewerUserId: string | null;
  reviewerName?: string | null;
  customerName?: string | null;
  serviceName?: string | null;
  collaboratorName?: string | null;
  approvalStatus: string;
  notes: string | null;
  /** % hoa hồng NV phụ trách — number hoặc decimal string */
  commissionPercent?: string | number | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiScheduleLine = {
  id?: string;
  dueDate?: string | null;
  amount: string | number;
  sortOrder?: number;
};

/** GET /orders/:orderId/payment-schedule — empty schedule is 200 + empty:true. */
export type ApiPaymentSchedule = {
  id?: string | null;
  orderId?: string;
  lines?: ApiScheduleLine[];
  items?: ApiScheduleLine[];
  empty?: boolean;
};

/** GET /orders/:id/detail — one RTT for order + finance + docs. */
export type ApiOrderDetail = {
  order: ApiOrder;
  paymentSchedule?: ApiPaymentSchedule | null;
  payments?: ApiPayment[] | { items?: ApiPayment[] };
  expenses?: ApiExpense[] | { items?: ApiExpense[] };
  documents?: ApiDocument[] | { items?: ApiDocument[] };
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
  /** % hoa hồng NV phụ trách (`assignedUserId`); null = chưa nhập */
  commissionPercent?: number | null;
};

/** Khớp UpdateOrderDto trên Swagger — không gửi field ngoài whitelist. */
export type UpdateOrderBody = {
  collaboratorId?: string | null;
  value?: number;
  totalNet?: number;
  totalGross?: number;
  vatRate?: number;
  currency?: string;
  notes?: string | null;
  channel?: string;
  reviewerUserId?: string | null;
  /** null = xóa % đã lưu */
  commissionPercent?: number | null;
};

function unwrapOrder(raw: ApiOrder | { data: ApiOrder } | null | undefined): ApiOrder {
  if (raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  return raw as ApiOrder;
}

export const ordersApi = {
  list(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    return apiRequest<PageResult<ApiOrder>>(`/orders?${params.toString()}`);
  },

  get(id: string) {
    return apiRequest<ApiOrder | { data: ApiOrder }>(`/orders/${id}`).then(unwrapOrder);
  },

  getDetail(id: string) {
    return apiRequest<ApiOrderDetail | { data: ApiOrderDetail }>(`/orders/${id}/detail`).then((raw) => {
      if (raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
        return raw.data;
      }
      return raw as ApiOrderDetail;
    });
  },

  create(body: CreateOrderBody) {
    return apiRequest<ApiOrder>("/orders", { method: "POST", body: JSON.stringify(body) });
  },

  update(id: string, body: UpdateOrderBody) {
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
    return apiRequest<ApiPaymentSchedule | ApiScheduleLine[]>(
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
