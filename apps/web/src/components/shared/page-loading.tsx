"use client";

import { Skeleton, theme } from "antd";

/** Full-page loading placeholder for detail screens while store hydrates. */
export function PageLoading() {
  const { token } = theme.useToken();

  return (
    <div style={{ padding: 24 }}>
      <Skeleton
        active
        title={{ width: 200 }}
        paragraph={false}
        style={{ marginBottom: 16 }}
      />
      <Skeleton
        active
        paragraph={{ rows: 6 }}
        style={{
          padding: 16,
          background: token.colorBgContainer,
          borderRadius: token.borderRadiusLG,
          border: `1px solid ${token.colorBorder}`,
        }}
      />
    </div>
  );
}
