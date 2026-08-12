"use client";

import { Space, Typography, theme } from "antd";
import type { ReactNode } from "react";

/** Toolbar hiện khi có dòng được chọn trên list. */
export function BulkActionBar({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  const { token } = theme.useToken();

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
      <Typography.Text strong>Đã chọn {count}</Typography.Text>
      <div style={{ flex: 1 }} />
      <Space wrap>{children}</Space>
    </div>
  );
}
