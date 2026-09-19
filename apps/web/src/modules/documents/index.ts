export { documentsApi, type ApiDocument, type DocumentDownload } from "@/modules/documents/api";
export {
  formatFileBytes,
  encodeLicenseFileType,
  parseLicenseFileType,
  isLicenseDocument,
  encodeVatFileType,
  parseVatFileType,
  isVatDocument,
  isVatDocumentForInvoice,
  mapApiDocumentToAttachment,
  mergeAttachments,
} from "@/modules/documents/map-to-ui";
export {
  filePreviewKind,
  shouldDeferInlinePreview,
  PREVIEW_INLINE_MAX_BYTES,
  resolveDocumentLink,
  downloadDocument,
  downloadOrderDocument,
  loadDocumentPreview,
  officeEmbedUrl,
  type FilePreviewKind,
} from "@/modules/documents/open-file";
export {
  useDocumentViewer,
  canPreviewDocument,
  type DocumentFileRef,
  type DocumentViewer,
} from "@/modules/documents/use-document-viewer";
