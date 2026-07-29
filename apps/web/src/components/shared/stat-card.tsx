"use client";

import { Card, Statistic } from "antd";
import type { ReactNode } from "react";
import { ds } from "@/lib/design-tokens";

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
  return (
    <Card
      size="small"
      styles={{ body: { padding: 20 } }}
      style={{
        border: `1px solid ${ds.hairline}`,
        borderRadius: ds.radius.lg,
        boxShadow: ds.shadow,
        background: ds.surface,
      }}
    >
      <Statistic
        title={<span style={{ color: ds.inkMuted, fontWeight: 500, fontSize: 13 }}>{title}</span>}
        value={value}
        prefix={prefix}
        suffix={suffix}
        valueStyle={{ color: ds.ink, fontWeight: 700, fontSize: 22, letterSpacing: "-0.3px" }}
      />
    </Card>
  );
}
