"use client";

import { Badge } from "antd";
import { ds } from "@/lib/design-tokens";

/** Small red count. Hidden at 0. Shows 99+ above 99. */
export function UnreadBadge({ count, title }: { count: number; title?: string }) {
  if (!Number.isFinite(count) || count <= 0) return null;
  return (
    <Badge
      count={Math.floor(count)}
      overflowCount={99}
      size="small"
      color={ds.danger}
      title={title}
      style={{ boxShadow: "none" }}
    />
  );
}
