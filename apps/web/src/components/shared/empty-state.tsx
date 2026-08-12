"use client";

import { Button, Empty } from "antd";
import Link from "next/link";

export function EmptyState({
  description,
  action,
  compact = false,
}: {
  description: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  /** Tighter padding for use inside Table locale.emptyText */
  compact?: boolean;
}) {
  const actionNode = action ? (
    action.href ? (
      <Link href={action.href}>
        <Button type="primary">{action.label}</Button>
      </Link>
    ) : (
      <Button type="primary" onClick={action.onClick}>
        {action.label}
      </Button>
    )
  ) : undefined;

  return (
    <div style={{ padding: compact ? 24 : 48 }}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
        {actionNode}
      </Empty>
    </div>
  );
}
