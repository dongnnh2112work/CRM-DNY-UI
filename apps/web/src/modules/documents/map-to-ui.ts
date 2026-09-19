import { getAttachmentType } from "@/lib/order-workflow";
import type { OrderAttachment } from "@/lib/types";
import type { ApiDocument } from "@/modules/documents/api";

const LICENSE_PREFIX = "license";
const VAT_PREFIX = "vat";

export function formatFileBytes(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function encodeLicenseFileType(issuedAt?: string, expiresAt?: string) {
  return `${LICENSE_PREFIX}|${issuedAt ?? ""}|${expiresAt ?? ""}`;
}

export function parseLicenseFileType(fileType: string | null | undefined): {
  isLicense: boolean;
  issuedAt?: string;
  expiresAt?: string;
} {
  if (!fileType) return { isLicense: false };
  if (fileType === LICENSE_PREFIX || fileType.startsWith(`${LICENSE_PREFIX}|`)) {
    const parts = fileType.split("|");
    return {
      isLicense: true,
      issuedAt: parts[1] || undefined,
      expiresAt: parts[2] || undefined,
    };
  }
  return { isLicense: false };
}

export function isLicenseDocument(doc: Pick<ApiDocument, "fileType" | "fileName">) {
  if (parseLicenseFileType(doc.fileType).isLicense) return true;
  return (doc.fileName ?? "").toLowerCase().includes("license");
}

export function encodeVatFileType(invoiceId: string) {
  return `${VAT_PREFIX}|${invoiceId}`;
}

export function parseVatFileType(fileType: string | null | undefined): {
  isVat: boolean;
  invoiceId?: string;
} {
  if (!fileType) return { isVat: false };
  if (fileType === VAT_PREFIX) return { isVat: true };
  if (fileType.startsWith(`${VAT_PREFIX}|`)) {
    return { isVat: true, invoiceId: fileType.slice(VAT_PREFIX.length + 1) || undefined };
  }
  return { isVat: false };
}

export function isVatDocument(doc: Pick<ApiDocument, "fileType">) {
  return parseVatFileType(doc.fileType).isVat;
}

export function isVatDocumentForInvoice(doc: Pick<ApiDocument, "fileType">, invoiceId: string) {
  const parsed = parseVatFileType(doc.fileType);
  return parsed.isVat && parsed.invoiceId === invoiceId;
}

export function mapApiDocumentToAttachment(doc: ApiDocument, uploaderName?: string): OrderAttachment {
  const license = parseLicenseFileType(doc.fileType);
  const fileName = doc.fileName || "file";
  const createdAt = typeof doc.createdAt === "string" ? doc.createdAt : "";
  return {
    id: doc.id,
    name: fileName,
    type: getAttachmentType(fileName),
    size: typeof doc.fileSize === "number" && Number.isFinite(doc.fileSize) ? doc.fileSize : 0,
    uploadedBy: uploaderName ?? doc.uploadedByUserId ?? "",
    uploadedAt: createdAt.slice(0, 10) || new Date().toISOString().slice(0, 10),
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
  };
}

/** Keep optimistic rows the list API has not returned yet; never restore a locally deleted id. */
export function mergeAttachments(fromApi: OrderAttachment[], local: OrderAttachment[]): OrderAttachment[] {
  const localById = new Map(local.map((row) => [row.id, row]));
  const seen = new Set<string>();
  const next: OrderAttachment[] = [];
  for (const row of fromApi) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    if (localById.get(row.id)?.deleted) {
      next.push({ ...row, deleted: true });
    } else {
      next.push(row);
    }
  }
  for (const row of local) {
    if (!row.id || seen.has(row.id) || row.deleted) continue;
    seen.add(row.id);
    next.push(row);
  }
  return next;
}
