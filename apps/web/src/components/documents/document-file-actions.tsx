"use client";

import { DownloadOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Space, Tooltip, Typography } from "antd";
import type { CSSProperties, ReactNode } from "react";
import type { DocumentFileRef, DocumentViewer } from "@/modules/documents/use-document-viewer";
import { useT } from "@/lib/use-t";

export function DocumentFileLink({
  file,
  viewer,
  style,
}: {
  file: DocumentFileRef;
  viewer: DocumentViewer;
  style?: CSSProperties;
}) {
  return (
    <Typography.Link onClick={() => viewer.open(file)} style={style}>
      {file.name}
    </Typography.Link>
  );
}

/** Eye + download. Pass `extra` for delete / more actions. */
export function DocumentFileActions({
  file,
  viewer,
  extra,
}: {
  file: DocumentFileRef;
  viewer: DocumentViewer;
  extra?: ReactNode;
}) {
  const t = useT();
  return (
    <Space size={4}>
      <Tooltip title={t("docs.review")}>
        <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => viewer.open(file)} />
      </Tooltip>
      <Tooltip title={t("docs.download")}>
        <Button
          type="text"
          size="small"
          icon={<DownloadOutlined />}
          loading={viewer.isDownloading(file.id)}
          onClick={() => void viewer.download(file)}
        />
      </Tooltip>
      {extra}
    </Space>
  );
}
