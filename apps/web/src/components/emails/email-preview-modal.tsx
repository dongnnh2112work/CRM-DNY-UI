"use client";

import { Button, Modal, Typography, theme } from "antd";
import { ds } from "@/lib/design-tokens";
import { toEmailPreviewHtml } from "@/lib/email-preview";

export function EmailPreviewModal({
  open,
  onClose,
  subject,
  body,
}: {
  open: boolean;
  onClose: () => void;
  subject?: string;
  body?: string;
}) {
  const { token } = theme.useToken();
  const html = toEmailPreviewHtml(body ?? "");

  return (
    <Modal
      title="Xem trước email"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Đóng</Button>}
      width={800}
      centered
      destroyOnHidden
    >
      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
        Tiêu đề
      </Typography.Text>
      <Typography.Paragraph strong style={{ marginTop: 4, marginBottom: 16 }}>
        {subject?.trim() || "—"}
      </Typography.Paragraph>
      <div
        style={{
          border: `1px solid ${token.colorBorder}`,
          borderRadius: token.borderRadius,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        {html ? (
          <iframe
            title="Xem trước email"
            sandbox=""
            srcDoc={html}
            style={{ width: "100%", height: 480, border: 0, background: "#fff" }}
          />
        ) : (
          <div style={{ padding: 24, color: token.colorTextSecondary }}>Chưa có nội dung.</div>
        )}
      </div>
    </Modal>
  );
}
