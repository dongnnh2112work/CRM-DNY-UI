"use client";

import {
  AccountBookOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  FieldTimeOutlined,
  FileTextOutlined,
  MailOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  UserAddOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Typography, theme } from "antd";
import type { ReactNode } from "react";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDateTime } from "@/lib/format-date";
import type { AppNotification } from "@/lib/types";
import { useT } from "@/lib/use-t";
import {
  notificationLabelKey,
  notificationVisual,
  type NotificationIconKey,
  type NotificationTone,
} from "@/modules/notifications/model";

const ICONS: Record<NotificationIconKey, ReactNode> = {
  task: <UserAddOutlined />,
  "order-overdue": <FieldTimeOutlined />,
  "expense-pending": <AccountBookOutlined />,
  "expense-reviewed": <CheckCircleOutlined />,
  payment: <DollarOutlined />,
  "vat-soon": <FileTextOutlined />,
  "vat-overdue": <WarningOutlined />,
  license: <SafetyCertificateOutlined />,
  "user-pending": <ClockCircleOutlined />,
  "user-approved": <CheckCircleOutlined />,
  "email-sent": <MailOutlined />,
  "email-failed": <CloseCircleOutlined />,
  mention: <MessageOutlined />,
  bell: <BellOutlined />,
};

export function NotificationRow({
  item,
  variant = "card",
  onOpen,
}: {
  item: AppNotification;
  variant?: "card" | "menu";
  onOpen: (item: AppNotification) => void;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const typeKey = item.rawType ?? item.type;
  const label = t(notificationLabelKey(typeKey));
  const heading = item.title.trim() || label;
  const visual = notificationVisual(typeKey, item.title);
  const tone = toneColors(visual.tone, token);
  const clickable = Boolean(item.href);
  const compact = variant === "menu";

  const open = () => onOpen(item);

  return (
    <div
      role={clickable ? "link" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={open}
      onKeyDown={(event) => {
        if (!clickable || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        open();
      }}
      style={{
        display: "flex",
        gap: compact ? 8 : 12,
        alignItems: "flex-start",
        background: item.read ? (compact ? undefined : token.colorBgContainer) : token.colorPrimaryBg,
        border: compact ? undefined : `1px solid ${token.colorBorder}`,
        borderRadius: compact ? token.borderRadius : token.borderRadiusLG,
        padding: compact ? "8px 10px" : 16,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: compact ? 28 : 32,
          height: compact ? 28 : 32,
          borderRadius: token.borderRadius,
          background: tone.bg,
          color: tone.fg,
          flexShrink: 0,
          fontSize: ds.fontSize.bodySm,
        }}
      >
        {ICONS[visual.icon]}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {item.title.trim() ? (
            <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
              {label}
            </Typography.Text>
          ) : null}
          {!item.read ? (
            <Typography.Text style={{ fontSize: ds.fontSize.caption, color: ds.danger }}>
              {t("notif.new")}
            </Typography.Text>
          ) : null}
        </div>
        <Typography.Text strong style={{ fontSize: compact ? ds.fontSize.bodySm : ds.fontSize.body, display: "block" }}>
          {heading}
        </Typography.Text>
        {item.body ? (
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption, display: "block" }}>
            {item.body}
          </Typography.Text>
        ) : null}
        <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
          {formatDisplayDateTime(item.createdAt)}
        </Typography.Text>
      </div>
    </div>
  );
}

function toneColors(
  tone: NotificationTone,
  token: {
    colorError: string;
    colorErrorBg: string;
    colorWarning: string;
    colorWarningBg: string;
    colorSuccess: string;
    colorSuccessBg: string;
    colorPrimary: string;
    colorPrimaryBg: string;
  },
): { fg: string; bg: string } {
  if (tone === "danger") return { fg: token.colorError, bg: token.colorErrorBg };
  if (tone === "warning") return { fg: token.colorWarning, bg: token.colorWarningBg };
  if (tone === "success") return { fg: token.colorSuccess, bg: token.colorSuccessBg };
  return { fg: token.colorPrimary, bg: token.colorPrimaryBg };
}
