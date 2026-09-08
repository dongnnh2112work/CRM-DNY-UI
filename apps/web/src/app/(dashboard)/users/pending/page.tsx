"use client";

import { App, Button, Modal, Popconfirm, Select, Space, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { apiErrorMessage } from "@/lib/http/message";
import { unwrapList } from "@/lib/http/paging";
import { useSession } from "@/lib/session/session-provider";
import type { MessageKey } from "@/lib/i18n";
import { useT } from "@/lib/use-t";
import {
  APPROVAL_ROLE_CODES,
  identityAdminApi,
  type ApprovalRoleCode,
  type IdentityUser,
} from "@/modules/identity-admin/api";

function formatWhen(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

const ROLE_LABEL: Record<ApprovalRoleCode, MessageKey> = {
  SALES: "role.SALES",
  MANAGER: "role.MANAGER",
  LAWYER: "role.LAWYER",
  LEGAL_ASSISTANT: "role.LEGAL_ASSISTANT",
  ACCOUNTING: "role.ACCOUNTING",
  ADMIN: "role.ADMIN",
  SUPER_ADMIN: "role.SUPER_ADMIN",
  COLLABORATOR: "role.COLLABORATOR",
};

export default function PendingUsersPage() {
  const t = useT();
  const { message } = App.useApp();
  const { can } = useSession();
  const allowed = can("user.manage");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<IdentityUser[]>([]);
  const [approving, setApproving] = useState<IdentityUser | null>(null);
  const [roleCode, setRoleCode] = useState<ApprovalRoleCode>("SALES");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      const res = await identityAdminApi.listUsers({ status: "PENDING_APPROVAL", page: 1, pageSize: 50 });
      setItems(unwrapList(res));
    } catch (err) {
      setItems([]);
      message.error(apiErrorMessage(err, t("user.pendingForbidden")));
    } finally {
      setLoading(false);
    }
  }, [allowed, message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async () => {
    if (!approving) return;
    setSaving(true);
    try {
      await identityAdminApi.setUserRoles(approving.id, [roleCode]);
      await identityAdminApi.updateUser(approving.id, { status: "ACTIVE" });
      message.success(t("user.approvedToast"));
      setApproving(null);
      setRoleCode("SALES");
      await load();
    } catch (err) {
      message.error(apiErrorMessage(err, t("user.approveFailed")));
    } finally {
      setSaving(false);
    }
  };

  const reject = async (user: IdentityUser) => {
    try {
      await identityAdminApi.updateUser(user.id, { status: "SUSPENDED" });
      message.success(t("user.rejectedToast"));
      await load();
    } catch (err) {
      message.error(apiErrorMessage(err, t("user.approveFailed")));
    }
  };

  if (!allowed) {
    return (
      <>
        <PageHeader breadcrumbs={[{ title: t("nav.users"), href: "/users" }, { title: t("user.pendingTitle") }]} />
        <div style={{ padding: 24 }}>
          <Typography.Text type="secondary">{t("user.pendingForbidden")}</Typography.Text>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: t("nav.users"), href: "/users" }, { title: t("user.pendingTitle") }]}
        primaryAction={{ label: t("auth.checkAgain"), onClick: () => void load() }}
      />
      <DataTable<IdentityUser>
        rowKey="id"
        loading={loading}
        columns={[
          {
            title: t("common.email"),
            dataIndex: "email",
          },
          {
            title: t("common.fullName"),
            dataIndex: "displayName",
            render: (v: string) => v || "—",
          },
          {
            title: t("user.createdAt"),
            dataIndex: "createdAt",
            render: (v?: string) => formatWhen(v),
          },
          {
            title: t("common.status"),
            dataIndex: "status",
            render: (s: string) => <Tag color="gold">{s}</Tag>,
          },
          {
            title: t("common.actions"),
            key: "actions",
            render: (_, row) => (
              <Space>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    setRoleCode("SALES");
                    setApproving(row);
                  }}
                >
                  {t("user.approve")}
                </Button>
                <Popconfirm
                  title={t("user.rejectConfirm")}
                  okText={t("user.reject")}
                  cancelText={t("common.cancel")}
                  okButtonProps={{ danger: true }}
                  onConfirm={() => void reject(row)}
                >
                  <Button danger size="small">
                    {t("user.reject")}
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
        dataSource={items}
        columnManagerKey="pending-users"
        emptyDescription={t("user.pendingEmpty")}
      />

      <Modal
        title={t("user.approveTitle")}
        open={Boolean(approving)}
        onCancel={() => setApproving(null)}
        onOk={() => void approve()}
        okText={t("common.confirm")}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Typography.Paragraph type="secondary">{t("user.approveHint")}</Typography.Paragraph>
        {approving ? (
          <Typography.Paragraph>
            {approving.displayName || "—"} · {approving.email}
          </Typography.Paragraph>
        ) : null}
        <Typography.Text>{t("user.approveRole")}</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <Select
            style={{ width: "100%" }}
            value={roleCode}
            onChange={(v) => setRoleCode(v)}
            options={APPROVAL_ROLE_CODES.map((code) => ({
              value: code,
              label: `${t(ROLE_LABEL[code])} (${code})`,
            }))}
          />
        </div>
      </Modal>
    </>
  );
}
