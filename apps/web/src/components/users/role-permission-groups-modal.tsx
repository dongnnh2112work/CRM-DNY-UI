"use client";

import { PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Checkbox, Empty, Select, Space, Spin, Tag, Typography } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { PermissionGroupEditor } from "@/components/users/permission-group-editor";
import { ReassignPendingConfirmModal } from "@/components/users/reassign-pending-confirm";
import { permissionTitle } from "@/lib/permission-catalog";
import { ds } from "@/lib/design-tokens";
import { fetchAllPages, unwrapList, type PageResult } from "@/lib/http/paging";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";
import {
  identityAdminApi,
  type IdentityPermission,
  type IdentityPermissionGroup,
  type IdentityRole,
  type IdentityUser,
} from "@/modules/identity-admin/api";
import {
  findIdentityRoleForUi,
  permissionCodesOf,
  roleGroupCodes,
  roleHasGroupField,
  unwrapIdentityEntity,
} from "@/modules/identity-admin/map-to-ui";
import {
  applyLostRoles,
  detachGroupFromRoles,
  hydrateRolePermissionGroups,
  loadUsersWithRoles,
  remainingRoleCodesAfterGroupRemoval,
  rolesUsingGroup,
} from "@/modules/identity-admin/reassign-pending";

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

export function RolePermissionGroupsAdmin({
  initialUiRole,
}: {
  initialUiRole?: string | null;
}) {
  const t = useT();
  const { message } = App.useApp();
  const { can, user, refreshMe } = useSession();
  const { updateUser } = useUsers();
  const canManageRoles = can(PERMISSION.roleManage);
  const canManageGroups = can(PERMISSION.permissionManage);
  const canManageUsers = can(PERMISSION.userManage);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const [deleteTarget, setDeleteTarget] = useState<IdentityPermissionGroup | null>(null);
  const [deleteRoles, setDeleteRoles] = useState<IdentityRole[]>([]);
  const [deleteUsers, setDeleteUsers] = useState<IdentityUser[]>([]);
  const [deleteRemaining, setDeleteRemaining] = useState<Map<string, string[]>>(new Map());
  const [deleteHydratedRoles, setDeleteHydratedRoles] = useState<IdentityRole[]>([]);
  const [deleteSkipSelf, setDeleteSkipSelf] = useState(false);
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
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!roleId) return;
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
  }, [roleId]);

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

  const openDeleteGroup = async (group: IdentityPermissionGroup) => {
    if (!canManageGroups) return;
    setDeleting(true);
    try {
      const hydrated = await hydrateRolePermissionGroups(rolesRef.current);
      setRoles(hydrated);
      const attached = rolesUsingGroup(hydrated, group.code);
      let affected: IdentityUser[] = [];
      const remainingByUserId = new Map<string, string[]>();
      let identityUsers: IdentityUser[] = [];
      if (canManageUsers) {
        identityUsers = await loadUsersWithRoles();
        for (const item of identityUsers) {
          const remaining = remainingRoleCodesAfterGroupRemoval(item, hydrated, group.code);
          remainingByUserId.set(item.id, remaining);
          if (remaining.length === 0 && (item.roleCodes ?? []).length > 0) {
            affected.push(item);
          }
        }
      }
      const self = identityUsers.find((item) => item.id === user?.id);
      setDeleteTarget(group);
      setDeleteRoles(attached);
      setDeleteUsers(affected.filter((item) => item.id !== user?.id));
      setDeleteRemaining(remainingByUserId);
      setDeleteHydratedRoles(hydrated);
      setDeleteSkipSelf(
        Boolean(self && (remainingByUserId.get(self.id)?.length ?? 1) === 0 && (self.roleCodes ?? []).length > 0),
      );
    } catch (err) {
      message.error(apiErrorMessage(err, t("user.groupDeleteFailed")));
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const hydrated = deleteHydratedRoles.length ? deleteHydratedRoles : await hydrateRolePermissionGroups(rolesRef.current);
      const nextRoles = await detachGroupFromRoles(hydrated, deleteTarget.code);
      setRoles(nextRoles);
      setDraftCodes((prev) => prev.filter((code) => code.toUpperCase() !== deleteTarget.code.toUpperCase()));
      setLoadedCodes((prev) => prev.filter((code) => code.toUpperCase() !== deleteTarget.code.toUpperCase()));
      try {
        await identityAdminApi.setGroupPermissions(deleteTarget.id, []);
      } catch {
        // Group stays in catalog until BE adds DELETE /permission-groups/:id.
      }

      let parkedCount = 0;
      if (canManageUsers && deleteRemaining.size) {
        const identityUsers = await loadUsersWithRoles();
        const result = await applyLostRoles({
          users: identityUsers,
          remainingByUserId: deleteRemaining,
          skipUserId: user?.id,
        });
        parkedCount = result.parked.length;
        for (const parked of result.parked) {
          updateUser(parked.id, { status: "inactive" });
        }
        if (result.failed.length) {
          message.warning(
            t("user.reassignPartialFail", {
              count: String(result.failed.length),
            }),
          );
        }
      } else if (!canManageUsers && deleteRoles.length) {
        message.warning(t("user.reassignNeedUserManage"));
      }

      setGroups((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      const affectsMe = Boolean(
        user?.roleCodes?.some((code) =>
          nextRoles.some(
            (role) =>
              role.code.toUpperCase() === code.toUpperCase() &&
              roleGroupCodes(role).every((item) => item.toUpperCase() !== deleteTarget.code.toUpperCase()),
          ),
        ),
      );
      if (affectsMe) await refreshMe();
      message.success(
        parkedCount
          ? t("user.groupDeletedParked", { name: deleteTarget.name || deleteTarget.code, count: String(parkedCount) })
          : t("user.groupDeleted", { name: deleteTarget.name || deleteTarget.code }),
      );
      setDeleteTarget(null);
    } catch (err) {
      message.error(apiErrorMessage(err, t("user.groupDeleteFailed")));
    } finally {
      setDeleting(false);
    }
  };

  const allowed = canManageRoles || canManageGroups;

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: t("nav.users"), href: "/users" }, { title: t("nav.permissions") }]}
      >
        {canManageGroups ? (
          <Button
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingGroup(null);
              setEditorOpen(true);
            }}
          >
            {t("user.createGroup")}
          </Button>
        ) : null}
        {allowed ? (
          <Button
            type="primary"
            loading={saving}
            disabled={!canManageRoles || !selected || loading}
            onClick={() => void onSave()}
          >
            {t("user.saveRoleGroups")}
          </Button>
        ) : null}
      </PageHeader>
      <div style={{ padding: 16, maxWidth: 880 }}>
        {!allowed ? (
          <Typography.Text type="secondary">{t("user.roleGroupsNeedRoleManage")}</Typography.Text>
        ) : (
          <>
            <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm, marginTop: 0 }}>
              {t("user.roleGroupsHint")}
            </Typography.Paragraph>
            {!canManageRoles ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t("user.roleGroupsNeedRoleManage")} />
            ) : null}
            {loadError ? <Alert type="error" showIcon style={{ marginBottom: 12 }} title={loadError} /> : null}
            {!loading && selected && !groupsKnown ? (
              <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t("user.roleGroupsUnknown")} />
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

            {!loading && orderViewFrom.length > 0 ? (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 12 }}
                title={t("user.roleGroupsStillHas", {
                  perm: permissionTitle("order.view", t),
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
                      <Tag
                        key={perm}
                        color={perm === "order.view" ? "blue" : undefined}
                        title={`${perm} · ${from.join(", ")}`}
                      >
                        {permissionTitle(perm, t)}
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
                              <Tag key={perm} title={perm}>
                                {permissionTitle(perm, t)}
                              </Tag>
                            ))}
                          </Space>
                        ) : null}
                      </Space>
                      {canManageGroups ? (
                        <Space size={0} onClick={(e) => e.stopPropagation()}>
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
                          <Button
                            size="small"
                            type="link"
                            danger
                            loading={deleting && deleteTarget?.id === group.id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              void openDeleteGroup(group);
                            }}
                          >
                            {t("common.delete")}
                          </Button>
                        </Space>
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
          </>
        )}
      </div>

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
      <ReassignPendingConfirmModal
        open={Boolean(deleteTarget)}
        title={t("user.deleteGroupTitle", { name: deleteTarget?.name || deleteTarget?.code || "" })}
        hint={t("user.deleteGroupBody")}
        attachedRoles={deleteRoles}
        users={deleteUsers}
        skippedSelf={deleteSkipSelf}
        confirmLoading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteGroup()}
      />
    </>
  );
}
