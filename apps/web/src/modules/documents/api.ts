import { apiRequest, apiUpload } from "@/lib/http/client";
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

export type DocumentDownload = {
  id: string;
  fileName: string;
  mimeType: string | null;
  expiresIn: number;
  downloadUrl: string;
};

function unwrapData<T extends object>(raw: T | { data: T } | null | undefined): T {
  if (raw && typeof raw === "object" && "data" in raw && raw.data && typeof raw.data === "object") {
    return raw.data;
  }
  return raw as T;
}

function unwrapDocument(raw: ApiDocument | { data: ApiDocument } | null | undefined): ApiDocument {
  return unwrapData(raw);
}

function unwrapDownload(raw: DocumentDownload | { data: DocumentDownload } | null | undefined): DocumentDownload {
  const info = unwrapData(raw);
  if (!info?.downloadUrl) throw new Error("Missing downloadUrl");
  return {
    id: info.id ?? "",
    fileName: info.fileName || "file",
    mimeType: info.mimeType ?? null,
    expiresIn: typeof info.expiresIn === "number" ? info.expiresIn : 0,
    downloadUrl: info.downloadUrl,
  };
}

export const documentsApi = {
  list(query: { page?: number; pageSize?: number; orderId?: string } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 50));
    if (query.orderId) params.set("orderId", query.orderId);
    return apiRequest<PageResult<ApiDocument>>(`/documents?${params.toString()}`);
  },

  upload(
    file: File,
    meta: { orderId?: string; contractId?: string; fileType?: string },
    onProgress?: (percent: number) => void,
  ) {
    const form = new FormData();
    form.append("file", file);
    if (meta.orderId) form.append("orderId", meta.orderId);
    if (meta.contractId) form.append("contractId", meta.contractId);
    if (meta.fileType) form.append("fileType", meta.fileType);
    return apiUpload<ApiDocument | { data: ApiDocument }>("/documents/upload", form, onProgress).then(
      unwrapDocument,
    );
  },

  downloadUrl(id: string) {
    return apiRequest<DocumentDownload | { data: DocumentDownload }>(`/documents/${id}/download-url`).then(
      unwrapDownload,
    );
  },

  remove(id: string) {
    return apiRequest<void>(`/documents/${id}`, { method: "DELETE" });
  },
};
