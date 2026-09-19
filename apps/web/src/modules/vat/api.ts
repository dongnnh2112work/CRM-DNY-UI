import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiVatInvoice = {
  id: string;
  invoiceNumber: string;
  orderId: string;
  paymentId: string | null;
  sourceType: string;
  customerName: string | null;
  customerTaxCode: string | null;
  netAmount: string;
  vatRate: string;
  vatAmount: string;
  grossAmount: string;
  status: string;
  issueDate: string | null;
  lines: unknown;
  createdAt: string;
  updatedAt: string;
};

function unwrapVat(raw: ApiVatInvoice | { data: ApiVatInvoice } | null | undefined): ApiVatInvoice {
  if (raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    return raw.data;
  }
  return raw as ApiVatInvoice;
}

export const vatApi = {
  list(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 20));
    return apiRequest<PageResult<ApiVatInvoice>>(`/vat-invoices?${params.toString()}`);
  },

  create(body: {
    invoiceNumber: string;
    orderId: string;
    sourceType: string;
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    paymentId?: string;
    customerName?: string;
    customerTaxCode?: string;
    vatRate?: number;
    lines?: unknown;
  }) {
    return apiRequest<ApiVatInvoice | { data: ApiVatInvoice }>("/vat-invoices", {
      method: "POST",
      body: JSON.stringify(body),
    }).then(unwrapVat);
  },

  get(id: string) {
    return apiRequest<ApiVatInvoice | { data: ApiVatInvoice }>(`/vat-invoices/${id}`).then(unwrapVat);
  },

  issue(id: string, issueDate?: string) {
    return apiRequest<ApiVatInvoice>(`/vat-invoices/${id}/issue`, {
      method: "POST",
      body: JSON.stringify({ issueDate }),
    });
  },

  cancel(id: string) {
    return apiRequest<ApiVatInvoice>(`/vat-invoices/${id}/cancel`, { method: "POST" });
  },
};
