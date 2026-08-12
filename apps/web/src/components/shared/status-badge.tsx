"use client";

import { Tag, type TagProps } from "antd";
import { useStatusMeta } from "@/lib/order-status-store";
import type { StatusModule } from "@/lib/status-config";

type StatusBadgeProps = Omit<TagProps, "color" | "children"> & {
  module: StatusModule;
  status: string;
};

export function StatusBadge({ module, status, ...tagProps }: StatusBadgeProps) {
  const meta = useStatusMeta(module, status);
  return (
    <Tag color={meta.color} {...tagProps}>
      {meta.label}
    </Tag>
  );
}
