"use client";

import { Tag, type TagProps } from "antd";
import { getStatusMeta, type StatusModule } from "@/lib/status-config";

type StatusBadgeProps = Omit<TagProps, "color" | "children"> & {
  module: StatusModule;
  status: string;
};

export function StatusBadge({ module, status, ...tagProps }: StatusBadgeProps) {
  const meta = getStatusMeta(module, status);
  return (
    <Tag color={meta.color} {...tagProps}>
      {meta.label}
    </Tag>
  );
}
