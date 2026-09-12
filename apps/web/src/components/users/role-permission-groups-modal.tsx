"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, Empty, Modal, Select, Space, Spin, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PermissionGroupEditor } from "@/components/users/permission-group-editor";
import { ds } from "@/lib/design-tokens";
import { fetchAllPages, unwrapList, type PageResult } from "@/lib/http/paging";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import {
  identityAdminApi,
  type IdentityPermission,
  type IdentityPermissionGroup,
  type IdentityRole,
} from "@/modules/identity-admin/api";
import {
  findIdentityRoleForUi,
  permissionCodesOf,
  roleGroupCodes,
  roleHasGroupField,
  unwrapIdentityEntity,
} from "@/modules/identity-admin/map-to-ui";

async function loadCatalogRows<T>(
  paged: (page: number, pageSize: number) => Promise<PageResult<T> | T[]>,
  fallback: () => Promise<PageResult<T> | T[]>,
): Promise<T[]> {
  try {
    const rows = await fetchAllPages(paged);
    if (rows.length) return rows;
  } catch {
    // BE may not accept page query — fall back to unfiltered list.
  }
  return unwrapList(await fallback());
}

export function RolePermissionGroupsModal({
  open,
  onClose,
  initialUiRole,
}: {
  open: boolean;
  onClose: () => void;
  initialUiRole?: string | null;
}) {
  const t = useT();
  const { message } = App.useApp();
  const { can, user, refreshMe } = useSession();
  const canManageRoles = can(PERMISSION.roleManage);
  const canManageGroups = can(PERMISSION.permissionManage);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [roles, setRoles] = useState<IdentityRole[]>([]);
  const [groups, setGroups] = useState<IdentityPermissionGroup[]>([]);
  const [catalog, setCatalog] = useState<IdentityPermission[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<IdentityPermissionGroup | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [draftCodes, setDraftCodes] = useState<string[]>([]);
  const [loadedCodes, setLoadedCodes] = useState<string[]>([]);
  const [groupsKnown, setGroupsKnown] = useState(false);
  const rolesRef = useRef(roles);
  rolesRef.current = roles;

  const selected = useMemo(() => roles.find((r) => r.id === roleId) ?? null, [roles, roleId]);

  const effectivePerms = useMemo(() => {
    const sources = new Map<string, string[]>();
    for (const group of groups) {
      if (!draftCodes.includes(group.code)) continue;
      for (const perm of permissionCodesOf(group)) {
        const list = sources.get(perm) ?? [];
        if (!list.includes(group.code)) list.push(group.code);
        sources.set(perm, list);
      }
    }
    return [...sources.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [groups, draftCodes]);

  const orderViewFrom = effectivePerms.find(([perm]) => perm === "order.view")?.[1] ?? [];

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [apiRoles, groupsResult, permsResult] = await Promise.all([
        loadCatalogRows<IdentityRole>(
          (page, pageSize) => identityAdminApi.listRoles({ page, pageSize }),
          () => identityAdminApi.listRoles(),
        ),
        loadCatalogRows<IdentityPermissionGroup>(
          (page, pageSize) => identityAdminApi.listPermissionGroups({ page, pageSize }),
          () => identityAdminApi.listPermissionGroups(),
        ).then(
          (rows) => ({ rows, error: null as string | null }),
          (err: unknown) => ({
            rows: [] as IdentityPermissionGroup[],
            error: apiErrorMessage(err, t("user.roleGroupsLoadFailed")),
          }),
        ),
        loadCatalogRows<IdentityPermission>(
          (page, pageSize) => identityAdminApi.listPermissions({ page, pageSize }),
          () => identityAdminApi.listPermissions(),
        ).then(
          (rows) => rows,
          () => [] as IdentityPermission[],
        ),
      ]);
      setCatalog(
        permsResult
          .map((row) => unwrapIdentityEntity<IdentityPermission>(row) ?? row)
          .filter((row) => row?.code),
      );
      const apiGroups = groupsResult.rows;
      if (groupsResult.error) setLoadError(groupsResult.error);
      const roleRows = apiRoles
        .map((row) => unwrapIdentityEntity<IdentityRole>(row) ?? row)
        .filter((row) => row?.id && row.code);
      const groupRows = apiGroups
        .map((row) => unwrapIdentityEntity<IdentityPermissionGroup>(row) ?? row)
        .filter((row) => row?.id && row.code)
        .sort((a, b) => a.code.localeCompare(b.code));
      setRoles(roleRows);
      setGroups(groupRows);
      const preferred =
        (initialUiRole ? findIdentityRoleForUi(roleRows, initialUiRole) : undefined) ?? roleRows[0];
      setRoleId(preferred?.id ?? null);
    } catch (err) {
      setLoadError(apiErrorMessage(err, t("user.roleGroupsLoadFailed")));
      setRoles([]);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [initialUiRole, t]);

  useEffect(() => {
    if (open) void loadCatalog();
  }, [open, loadCatalog]);

  useEffect(() => {
    if (!open || !roleId) return;
    let cancelled = false;
    const cached = rolesRef.current.find((r) => r.id === roleId);
    const fromList = roleGroupCodes(cached);
    if (cached && roleHasGroupField(cached)) {
      setDraftCodes(fromList);
      setLoadedCodes(fromList);
      setGroupsKnown(true);
      return;
    }
    void identityAdminApi
      .getRole(roleId)
      .then((raw) => {
        if (cancelled) return;
        const role = unwrapIdentityEntity<IdentityRole>(raw);
        const codes = roleGroupCodes(role);
        setDraftCodes(codes);
        setLoadedCodes(codes);
        setGroupsKnown(roleHasGroupField(role));
        if (role) {
          setRoles((prev) => prev.map((item) => (item.id === role.id ? { ...item, ...role } : item)));
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDraftCodes(fromList);
        setLoadedCodes(fromList);
        setGroupsKnown(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, roleId]);

  const dirty = useMemo(() => {
    const a = [...draftCodes].sort();
    const b = [...loadedCodes].sort();
    return a.length !== b.length || a.some((code, i) => code !== b[i]);
  }, [draftCodes, loadedCodes]);

  const onSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await identityAdminApi.setRolePermissionGroups(selected.id, draftCodes);
      setLoadedCodes(draftCodes);
      setGroupsKnown(true);
      setRoles((prev) =>
        prev.map((item) =>
          item.id === selected.id ? { ...item, permissionGroupCodes: draftCodes } : item,
        ),
      );
      const affectsMe = Boolean(
        user?.roleCodes?.some((code) => code.toUpperCase() === selected.code.toUpperCase()),
      );
      if (affectsMe) await refreshMe();
      else message.info(t("user.refreshSessionHint"));
      message.success(t("user.roleGroupsSaved", { role: selected.name || selected.code }));
    } catch (err) {
      message.error(apiErrorMessage(err, t("user.roleGroupsSaveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={t("user.roleGroups")}
      open={open}
      onCancel={onClose}
      width={720}
      centered
      okText={t("user.saveRoleGroups")}
      cancelText={t("common.cancel")}
      confirmLoading={saving}
      okButtonProps={{ disabled: !canManageRoles || !selected || loading }}
      onOk={onSave}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm, marginTop: 0 }}>
        {t("user.roleGroupsHint")}
      </Typography.Paragraph>
      {!canManageRoles ? (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t("user.roleGroupsNeedRoleManage")} />
      ) : null}
      {loadError ? <Alert type="error" showIcon style={{ marginBottom: 12 }} message={loadError} /> : null}
      {!loading && selected && !groupsKnown ? (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t("user.roleGroupsUnknown")} />
      ) : null}

      <Select
        style={{ width: "100%", marginBottom: 16 }}
        placeholder={t("user.selectRole")}
        value={roleId ?? undefined}
        options={roles.map((r) => ({
          value: r.id,
          label: `${r.name || r.code} (${r.code})`,
        }))}
        onChange={(id) => setRoleId(id)}
        disabled={loading}
      />
      {canManageGroups ? (
        <Button
          icon={<PlusOutlined />}
          style={{ marginBottom: 12 }}
          onClick={() => {
            setEditingGroup(null);
            setEditorOpen(true);
          }}
        >
          {t("user.createGroup")}
        </Button>
      ) : null}

      {!loading && orderViewFrom.length > 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t("user.roleGroupsStillHas", {
            perm: "order.view",
            groups: orderViewFrom.join(", "),
          })}
        />
      ) : null}
      {!loading && effectivePerms.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
            {t("user.roleGroupsEffective")}
          </Typography.Text>
          <div style={{ marginTop: 6 }}>
            <Space wrap size={[4, 4]}>
              {effectivePerms.map(([perm, from]) => (
                <Tag key={perm} color={perm === "order.view" ? "blue" : undefined} title={from.join(", ")}>
                  {perm}
                </Tag>
              ))}
            </Space>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin />
        </div>
      ) : groups.length === 0 ? (
        <Empty description={t("user.roleGroupsEmpty")} />
      ) : (
        <Checkbox.Group
          style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}
          value={draftCodes}
          disabled={!canManageRoles}
          onChange={(next) => setDraftCodes(next.map(String))}
        >
          {groups.map((group) => {
            const codes = permissionCodesOf(group);
            return (
              <div
                key={group.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 12px",
                  border: "1px solid var(--ant-color-border, #f0f0f0)",
                  borderRadius: 8,
                }}
              >
                <Checkbox value={group.code} style={{ marginInlineStart: 0, marginTop: 2 }} />
                <Space direction="vertical" size={4} style={{ flex: 1 }}>
                  <Space wrap size={6}>
                    <Typography.Text strong>{group.name || group.code}</Typography.Text>
                    <Tag>{group.code}</Tag>
                  </Space>
                  {codes.length ? (
                    <Space wrap size={[4, 4]}>
                      {codes.map((perm) => (
                        <Tag key={perm}>{perm}</Tag>
                      ))}
                    </Space>
                  ) : null}
                </Space>
                {canManageGroups ? (
                  <Button
                    size="small"
                    type="link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditingGroup(group);
                      setEditorOpen(true);
                    }}
                  >
                    {t("common.edit")}
                  </Button>
                ) : null}
              </div>
            );
          })}
        </Checkbox.Group>
      )}

      {dirty ? (
        <Typography.Paragraph type="secondary" style={{ margin: "12px 0 0", fontSize: ds.fontSize.bodySm }}>
          {t("user.roleGroupsReplaceHint")}
        </Typography.Paragraph>
      ) : null}

      <PermissionGroupEditor
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditingGroup(null);
        }}
        group={editingGroup}
        catalog={catalog}
        onSaved={(next) => {
          setGroups((prev) => {
            const exists = prev.some((item) => item.id === next.id);
            const rows = exists
              ? prev.map((item) => (item.id === next.id ? { ...item, ...next } : item))
              : [...prev, next];
            return rows.sort((a, b) => a.code.localeCompare(b.code));
          });
          if (!editingGroup) {
            setDraftCodes((prev) => (prev.includes(next.code) ? prev : [...prev, next.code]));
          }
        }}
      />
    </Modal>
  );
}
