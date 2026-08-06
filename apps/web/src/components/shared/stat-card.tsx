"use client";

import { Card, Statistic, theme } from "antd";
import type { ReactNode } from "react";

export function StatCard({
  title,
  value,
  prefix,
  suffix,
}: {
  title: string;
  value: number | string;
  prefix?: ReactNode;
  suffix?: string;
}) {
  const { token } = theme.useToken();

  return (
    <Card
      size="small"
      styles={{ body: { padding: 20 } }}
      style={{
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
      }}
    >
      <Statistic
        title={
          <span style={{ color: token.colorTextSecondary, fontWeight: 500, fontSize: 13 }}>{title}</span>
        }
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ color: token.colorText, fontWeight: 700, fontSize: 22, letterSpacing: "-0.3px" }}
      />
    </Card>
  );
}
