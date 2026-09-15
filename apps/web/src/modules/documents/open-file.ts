import { documentsApi, type DocumentDownload } from "@/modules/documents/api";

export type FilePreviewKind = "pdf" | "image" | "office" | "file";

/** Skip inline iframe/embed above this size — user confirms or downloads. */
export const PREVIEW_INLINE_MAX_BYTES = 8 * 1024 * 1024;

type LinkCacheEntry = {
  info: DocumentDownload;
  expiresAt: number;
};

const linkCache = new Map<string, LinkCacheEntry>();

export function filePreviewKind(fileName: string, mimeType?: string | null): FilePreviewKind {
  const mime = (mimeType ?? "").toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (mime.includes("pdf") || ext === "pdf") return "pdf";
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("officedocument") ||
    ["doc", "docx", "xls", "xlsx"].includes(ext)
  ) {
    return "office";
  }
  return "file";
}

export function shouldDeferInlinePreview(size?: number | null) {
  return typeof size === "number" && Number.isFinite(size) && size > PREVIEW_INLINE_MAX_BYTES;
}

function clickDownload(href: string, fileName: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = fileName;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Nest signed URL, reused until shortly before TTL. */
export async function resolveDocumentLink(id: string): Promise<DocumentDownload> {
  const hit = linkCache.get(id);
  if (hit && hit.expiresAt - 30_000 > Date.now()) return hit.info;
  const info = await documentsApi.downloadUrl(id);
  const ttlMs = Math.max(60, info.expiresIn || 3600) * 1000;
  linkCache.set(id, { info, expiresAt: Date.now() + ttlMs });
  return info;
}

/** Open signed URL — browser/OS saves. No second JS blob fetch. */
export async function downloadDocument(id: string, fileName: string) {
  const info = await resolveDocumentLink(id);
  clickDownload(info.downloadUrl, info.fileName || fileName);
  return info;
}

/** @deprecated use `downloadDocument` */
export const downloadOrderDocument = downloadDocument;

export async function loadDocumentPreview(
  id: string,
  opts: { fileName?: string; size?: number | null; force?: boolean } = {},
): Promise<{
  info: DocumentDownload;
  src: string;
  kind: FilePreviewKind;
  deferred: boolean;
}> {
  const info = await resolveDocumentLink(id);
  const kind = filePreviewKind(opts.fileName || info.fileName, info.mimeType);
  return {
    info,
    src: info.downloadUrl,
    kind,
    deferred: !opts.force && shouldDeferInlinePreview(opts.size),
  };
}

export function officeEmbedUrl(downloadUrl: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(downloadUrl)}`;
}
