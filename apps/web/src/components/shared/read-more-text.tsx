"use client";

import { Typography } from "antd";
import { useT } from "@/lib/use-t";

const DEFAULT_ROWS = 2;

export function ReadMoreText({
  text,
  rows = DEFAULT_ROWS,
}: {
  text: string;
  rows?: number;
}) {
  const t = useT();
  const value = text.trim();
  if (!value) return "—";
  const short = value.length <= 80 && !value.includes("\n");
  if (short) return value;
  return (
    <Typography.Paragraph
      style={{ marginBottom: 0 }}
      ellipsis={{
        rows,
        expandable: "collapsible",
        symbol: (expanded) => (expanded ? t("common.readLess") : t("common.readMore")),
      }}
    >
      {value}
    </Typography.Paragraph>
  );
}
