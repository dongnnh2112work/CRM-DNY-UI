"use client";

import { Space, Typography } from "antd";
import { ds } from "@/lib/design-tokens";
import { permissionTitle } from "@/lib/permission-catalog";
import { useT } from "@/lib/use-t";

export function PermissionLabel({
  code,
  showCode = true,
}: {
  code: string;
  showCode?: boolean;
}) {
  const t = useT();
  const title = permissionTitle(code, t);
  return (
    <Space size={6} wrap>
      <span>{title}</span>
      {showCode && title !== code ? (
        <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
          {code}
        </Typography.Text>
      ) : null}
    </Space>
  );
}
