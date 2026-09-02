"use client";

import { Tag, Typography } from "antd";
import type { MouseEvent } from "react";

function openZalo(url: string, e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  window.open(url, "_blank", "noopener,noreferrer");
}

export function ZaloGroupLink({
  url,
  variant = "link",
}: {
  url?: string;
  variant?: "link" | "tag";
}) {
  const href = url?.trim();
  if (!href) {
    return variant === "tag" ? null : <span>—</span>;
  }
  if (variant === "tag") {
    return (
      <Tag color="blue" style={{ cursor: "pointer", margin: 0 }} onClick={(e) => openZalo(href, e)}>
        Zalo
      </Tag>
    );
  }
  return <Typography.Link onClick={(e) => openZalo(href, e)}>Group Zalo</Typography.Link>;
}
