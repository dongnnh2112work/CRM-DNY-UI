"use client";

import { Alert, Modal, Typography } from "antd";
import Link from "next/link";
import { ds } from "@/lib/design-tokens";
import { useT } from "@/lib/use-t";
import { formatIdentityUser } from "@/modules/identity-admin/reassign-pending";
import type { IdentityRole, IdentityUser } from "@/modules/identity-admin/api";

export function ReassignPendingConfirmModal({
  open,
  title,
  hint,
  attachedRoles,
  users,
  skippedSelf,
  confirmLoading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  hint: string;
  attachedRoles: IdentityRole[];
  users: IdentityUser[];
  skippedSelf: boolean;
  confirmLoading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useT();
  const preview = users.slice(0, 12);
  const extra = users.length - preview.length;

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onCancel}
      onOk={onConfirm}
      okText={t("common.delete")}
      cancelText={t("common.cancel")}
      okButtonProps={{ danger: true }}
      confirmLoading={confirmLoading}
      destroyOnHidden
      centered
      zIndex={1100}
      getContainer={() => document.body}
    >
      <Typography.Paragraph style={{ marginTop: 0 }}>{hint}</Typography.Paragraph>
      {attachedRoles.length ? (
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
          {t("user.reassignRolesUsing", {
            roles: attachedRoles.map((role) => role.name || role.code).join(", "),
          })}
        </Typography.Paragraph>
      ) : null}
      {users.length ? (
        <>
          <Typography.Paragraph>
            {t("user.reassignWillPark", { count: String(users.length) })}{" "}
            <Link href="/users/pending">{t("nav.pendingUsers")}</Link>
          </Typography.Paragraph>
          <ul style={{ margin: "0 0 12px", paddingLeft: 18 }}>
            {preview.map((user) => (
              <li key={user.id}>{formatIdentityUser(user)}</li>
            ))}
          </ul>
          {extra > 0 ? (
            <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
              {t("user.reassignMoreUsers", { count: String(extra) })}
            </Typography.Paragraph>
          ) : null}
        </>
      ) : (
        <Typography.Paragraph type="secondary">{t("user.reassignNoUsers")}</Typography.Paragraph>
      )}
      {skippedSelf ? (
        <Alert type="warning" showIcon style={{ marginBottom: 8 }} title={t("user.reassignSkipSelf")} />
      ) : null}
    </Modal>
  );
}
