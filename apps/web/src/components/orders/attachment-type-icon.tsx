import {
  FileExcelOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { ds } from "@/lib/design-tokens";
import type { AttachmentType } from "@/lib/types";

const FILE_TYPE_COLOR: Record<AttachmentType, string> = {
  pdf: ds.danger,
  word: ds.primary,
  excel: ds.accentGreen,
  other: ds.inkMuted,
};

/** Shared file-type icon for order documents / license upload. */
export function attachmentTypeIcon(type: AttachmentType): ReactNode {
  const color = FILE_TYPE_COLOR[type];
  if (type === "pdf") return <FilePdfOutlined style={{ color }} />;
  if (type === "word") return <FileWordOutlined style={{ color }} />;
  if (type === "excel") return <FileExcelOutlined style={{ color }} />;
  return <PaperClipOutlined style={{ color }} />;
}
