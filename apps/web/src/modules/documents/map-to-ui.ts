import { getAttachmentType } from "@/lib/order-workflow";
import type { OrderAttachment } from "@/lib/types";
import type { ApiDocument } from "@/modules/documents/api";

const LICENSE_PREFIX = "license";

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
  return doc.fileName.toLowerCase().includes("license");
}

export function mapApiDocumentToAttachment(doc: ApiDocument, uploaderName?: string): OrderAttachment {
  const license = parseLicenseFileType(doc.fileType);
  return {
    id: doc.id,
    name: doc.fileName,
    type: getAttachmentType(doc.fileName),
    size: doc.fileSize ?? 0,
    uploadedBy: uploaderName ?? doc.uploadedByUserId,
    uploadedAt: doc.createdAt.slice(0, 10),
    issuedAt: license.issuedAt,
    expiresAt: license.expiresAt,
  };
}
