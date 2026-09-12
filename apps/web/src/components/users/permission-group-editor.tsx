"use client";

import { Alert, App, Checkbox, Empty, Input, Modal, Space, Spin, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { ds } from "@/lib/design-tokens";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import {
  identityAdminApi,
  type IdentityPermission,
  type IdentityPermissionGroup,
} from "@/modules/identity-admin/api";
import { permissionCodesOf, unwrapIdentityEntity } from "@/modules/identity-admin/map-to-ui";

function slugifyGroupCode(label: string) {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base ? `custom.${base}` : `custom.${Date.now()}`;
}

function catalogCodes(items: IdentityPermission[]): IdentityPermission[] {
  const seen = new Set<string>();
  const rows: IdentityPermission[] = [];
  for (const item of items) {
    const code = item.code?.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    rows.push({ ...item, code });
  }
  return rows.sort((a, b) => a.code.localeCompare(b.code));
}

export function PermissionGroupEditor({
  open,
  onClose,
  group,
  catalog,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  group: IdentityPermissionGroup | null;
  catalog: IdentityPermission[];
  onSaved: (next: IdentityPermissionGroup) => void;
}) {
  const t = useT();
  const { message } = App.useApp();
  const { can } = useSession();
  const canManage = can(PERMISSION.permissionManage);
  const isCreate = !group;
  const permissions = useMemo(() => catalogCodes(catalog), [catalog]);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setCodeTouched(false);
    if (!group) {
      setName("");
      setCode("");
      setPicked([]);
      return;
    }
    setName(group.name || group.code);
    setCode(group.code);
    const existing = permissionCodesOf(group);
    if (existing.length) {
      setPicked(existing);
      return;
    }
    setLoadingDetail(true);
    void identityAdminApi
      .getPermissionGroup(group.id)
      .then((raw) => {
        const detail = unwrapIdentityEntity<IdentityPermissionGroup>(raw) ?? raw;
        setPicked(permissionCodesOf(detail));
      })
      .catch(() => setPicked([]))
      .finally(() => setLoadingDetail(false));
  }, [open, group]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        (item.description ?? "").toLowerCase().includes(q),
    );
  }, [permissions, query]);

  const onSave = async () => {
    const label = name.trim();
    const nextCode = (isCreate ? code.trim() : group.code).toLowerCase();
    if (!label) {
      message.warning(t("user.enterGroupName"));
      return;
    }
    if (isCreate && !nextCode) {
      message.warning(t("user.enterGroupCode"));
      return;
    }
    setSaving(true);
    try {
      let saved: IdentityPermissionGroup;
      if (isCreate) {
        const created = unwrapIdentityEntity<IdentityPermissionGroup>(
          await identityAdminApi.createPermissionGroup({ code: nextCode, name: label }),
        );
        if (!created?.id) throw new Error(t("user.groupSaveFailed"));
        saved = created;
      } else {
        saved = group;
      }
      const updated = unwrapIdentityEntity<IdentityPermissionGroup>(
        await identityAdminApi.setGroupPermissions(saved.id, picked),
      );
      onSaved({
        ...saved,
        ...updated,
        name: label,
        code: saved.code,
        permissions: picked,
      });
      message.success(isCreate ? t("user.groupCreated", { name: label }) : t("user.groupUpdated", { name: label }));
      onClose();
    } catch (err) {
      message.error(apiErrorMessage(err, t("user.groupSaveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={isCreate ? t("user.createGroup") : t("user.editGroup")}
      open={open}
      onCancel={onClose}
      width={640}
      centered
      okText={t("common.save")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      okButtonProps={{ disabled: !canManage || loadingDetail }}
      onOk={() => void onSave()}
      destroyOnHidden
    >
      {!canManage ? (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t("user.groupNeedPermManage")} />
      ) : null}
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
            {t("user.groupName")}
          </Typography.Text>
          <Input
            value={name}
            placeholder={t("user.groupNamePh")}
            disabled={!canManage || !isCreate}
            onChange={(e) => {
              const next = e.target.value;
              setName(next);
              if (isCreate && !codeTouched) setCode(slugifyGroupCode(next));
            }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
            {t("user.groupCode")}
          </Typography.Text>
          <Input
            value={code}
            placeholder={t("user.groupCodePh")}
            disabled={!canManage || !isCreate}
            onChange={(e) => {
              setCodeTouched(true);
              setCode(e.target.value);
            }}
          />
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
            {t("user.groupPerms")}
          </Typography.Text>
          <Input
            allowClear
            style={{ marginTop: 6, marginBottom: 8 }}
            placeholder={t("user.groupSearchPerms")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loadingDetail ? (
            <div style={{ textAlign: "center", padding: 16 }}>
              <Spin />
            </div>
          ) : permissions.length === 0 ? (
            <Empty description={t("user.groupCatalogEmpty")} />
          ) : (
            <Checkbox.Group
              style={{
                width: "100%",
                maxHeight: 320,
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
              value={picked}
              disabled={!canManage}
              onChange={(next) => setPicked(next.map(String))}
            >
              {filtered.map((item) => (
                <Checkbox key={item.code} value={item.code} style={{ marginInlineStart: 0 }}>
                  <Space size={6}>
                    <Typography.Text>{item.code}</Typography.Text>
                    {item.description ? (
                      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
                        {item.description}
                      </Typography.Text>
                    ) : null}
                  </Space>
                </Checkbox>
              ))}
            </Checkbox.Group>
          )}
        </div>
      </Space>
    </Modal>
  );
}
