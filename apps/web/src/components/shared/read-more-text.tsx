"use client";

import { Button, Modal, Typography } from "antd";
import { useState } from "react";
import { useT } from "@/lib/use-t";

const DEFAULT_PREVIEW = 80;

export function ReadMoreText({
  text,
}: {
  text: string;
  rows?: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const value = text.trim();
  if (!value) return "—";
  const singleLine = !value.includes("\n") && value.length <= DEFAULT_PREVIEW;
  if (singleLine) return value;

  const firstLine = value.split("\n")[0] ?? value;
  const preview =
    firstLine.length > DEFAULT_PREVIEW ? `${firstLine.slice(0, DEFAULT_PREVIEW)}…` : `${firstLine}…`;

  return (
    <>
      <span>{preview} </span>
      <Button
        type="link"
        size="small"
        style={{ padding: 0, height: "auto" }}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {t("common.readMore")}
      </Button>
      <Modal
        open={open}
        title={t("common.readMore")}
        footer={null}
        onCancel={(event) => {
          event.stopPropagation();
          setOpen(false);
        }}
        width={560}
      >
        <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
          {value}
        </Typography.Paragraph>
      </Modal>
    </>
  );
}
