"use client";

import { EntityDocuments } from "@/components/documents/entity-documents";
import type { OrderAttachment } from "@/lib/types";
import { useT } from "@/lib/use-t";

interface OrderDocumentsProps {
  attachments: OrderAttachment[];
  onChange: (next: OrderAttachment[]) => void;
  uploaderName?: string;
  orderId?: string;
}

/** Hồ sơ làm việc trong quá trình xử lý (không gồm giấy phép final) */
export function OrderDocuments({ attachments, onChange, uploaderName = "Admin", orderId }: OrderDocumentsProps) {
  const t = useT();
  return (
    <EntityDocuments
      orderId={orderId}
      fileType="work"
      attachments={attachments}
      onChange={onChange}
      uploaderName={uploaderName}
      intro={t("docs.intro")}
      emptyDescription={t("docs.empty")}
    />
  );
}
