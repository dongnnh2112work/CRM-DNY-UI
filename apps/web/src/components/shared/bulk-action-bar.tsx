"use client";

import { Space, Typography, theme } from "antd";
import type { ReactNode } from "react";
import { useT } from "@/lib/use-t";

/** Toolbar hiện khi có dòng được chọn trên list. */
export function BulkActionBar({
  count,
  summary,
  children,
}: {
  count: number;
  summary?: ReactNode;
  children?: ReactNode;
}) {
  const { token } = theme.useToken();
  const t = useT();

  if (count <= 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        padding: "8px 16px",
        margin: "0 16px",
        background: token.colorPrimaryBg,
        border: `1px solid ${token.colorPrimaryBorder}`,
        borderRadius: token.borderRadiusLG,
      }}
    >
      <Typography.Text strong>{t("common.selected", { count })}</Typography.Text>
      {summary ? <Typography.Text>{summary}</Typography.Text> : null}
      <div style={{ flex: 1 }} />
      {children ? <Space wrap>{children}</Space> : null}
    </div>
  );
}
