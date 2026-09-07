import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiDocument = {
  id: string;
  contractId: string | null;
  orderId: string | null;
  storageKey: string;
  fileName: string;
  fileType: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedByUserId: string;
  bucket: string;
  createdAt: string;
  updatedAt: string;
};

export const documentsApi = {
  list(query: { page?: number; pageSize?: number; orderId?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 50));
    if (query.orderId) params.set("orderId", query.orderId);
    return apiRequest<PageResult<ApiDocument>>(`/documents?${params.toString()}`);
  },

  upload(file: File, meta: { orderId?: string; contractId?: string; fileType?: string }) {
    const form = new FormData();
    form.append("file", file);
    if (meta.orderId) form.append("orderId", meta.orderId);
    if (meta.contractId) form.append("contractId", meta.contractId);
    if (meta.fileType) form.append("fileType", meta.fileType);
    return apiRequest<ApiDocument>("/documents/upload", { method: "POST", body: form });
  },

  downloadUrl(id: string) {
    return apiRequest<{ id: string; fileName: string; mimeType: string | null; expiresIn: number; downloadUrl: string }>(
      `/documents/${id}/download-url`,
    );
  },

  remove(id: string) {
    return apiRequest<void>(`/documents/${id}`, { method: "DELETE" });
  },
};
