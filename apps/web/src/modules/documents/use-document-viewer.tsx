"use client";

import { App } from "antd";
import { useCallback, useState } from "react";
import { DocumentReviewModal } from "@/components/documents/document-review-modal";
import { apiErrorMessage, isUuid } from "@/lib/http/message";
import { downloadDocument } from "@/modules/documents/open-file";
import { useT } from "@/lib/use-t";

export type DocumentFileRef = {
  id: string;
  name: string;
  size?: number;
};

export function canPreviewDocument(id?: string | null): id is string {
  return isUuid(id);
}

/** Shared view / download for any Nest document id (orders, contracts, VAT, …). */
export function useDocumentViewer() {
  const t = useT();
  const { message } = App.useApp();
  const [target, setTarget] = useState<DocumentFileRef | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const open = useCallback(
    (file: DocumentFileRef) => {
      if (!canPreviewDocument(file.id)) {
        message.warning(t("docs.reviewUnavailable"));
        return;
      }
      setTarget({ id: file.id, name: file.name, size: file.size });
    },
    [message, t],
  );

  const download = useCallback(
    async (file: DocumentFileRef) => {
      if (!canPreviewDocument(file.id)) {
        message.warning(t("docs.reviewUnavailable"));
        return;
      }
      setBusyId(file.id);
      try {
        await downloadDocument(file.id, file.name);
      } catch (err) {
        message.error(apiErrorMessage(err, t("docs.reviewFailed")));
      } finally {
        setBusyId(null);
      }
    },
    [message, t],
  );

  const close = useCallback(() => setTarget(null), []);

  const modal = (
    <DocumentReviewModal
      open={Boolean(target)}
      documentId={target?.id}
      fileName={target?.name}
      fileSize={target?.size}
      onClose={close}
    />
  );

  return {
    open,
    download,
    close,
    busyId,
    isDownloading: (id: string) => busyId === id,
    canPreview: canPreviewDocument,
    modal,
  };
}

export type DocumentViewer = ReturnType<typeof useDocumentViewer>;
