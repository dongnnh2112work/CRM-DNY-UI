"use client";

import { PlusOutlined, UserOutlined } from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from "antd";
import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { PermissionMatrix } from "@/components/users/permission-matrix";
import { UserProfileForm } from "@/components/users/user-profile-form";
import { ds } from "@/lib/design-tokens";
import {
  emptyPagePermissions,
  normalizePagePermissions,
  type AppUser,
  type RolePagePermissions,
  type UserRole,
} from "@/lib/types";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import { apiErrorMessage } from "@/lib/http/message";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";
import { identityAdminApi } from "@/modules/identity-admin/api";
import {
  mapIdentityUserToUi,
  uiRoleToApiCodes,
  uiStatusToApi,
} from "@/modules/identity-admin/map-to-ui";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

function formatDob(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function UsersPage() {
  const t = useT();
  const { message } = App.useApp();
  const {
    users,
    roles,
    createUser,
    updateUser,
    rolePermissions,
    updateRolePermissions,
    createRole,
    deleteRole,
    getRoleLabel,
  } = useUsers();
  const [profileOpen, setProfileOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [permRole, setPermRole] = useState<UserRole | null>(null);
  const [draftPerms, setDraftPerms] = useState<RolePagePermissions | null>(null);
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [query, setQuery] = useState("");
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
  }, []);
  const [saving, setSaving] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  const filtered = users.filter((u) =>
    matchesTableQuery(query, [
      u.name,
      u.email,
      u.phone,
      u.dateOfBirth,
      formatDob(u.dateOfBirth),
      u.address,
      u.role,
      getRoleLabel(u.role),
      u.status,
      getStatusMeta("user", u.status).label,
      u.authMethod,
      u.useCustomPermissions ? "custom" : null,
    ]),
  );

  useEffect(() => {
    if (permRole) {
      setDraftPerms(
        normalizePagePermissions(rolePermissions[permRole] ?? emptyPagePermissions()),
      );
    } else {
      setDraftPerms(null);
    }
  }, [permRole, rolePermissions]);

  const openCreate = () => {
    setEditUser(null);
    setProfileOpen(true);
  };

  const openUser = (user: AppUser) => {
    setEditUser(user);
    setProfileOpen(true);
  };

  const closeProfile = () => {
    setProfileOpen(false);
    setEditUser(null);
  };

  const openRolePerms = (roleKey: UserRole) => {
    setPermRole(roleKey);
    setNewRoleLabel("");
  };

  const selectedRoleDef = permRole ? roles.find((r) => r.key === permRole) : null;

  const columns: TableColumnsType<AppUser> = [
    {
      title: "",
      key: "avatar",
      width: 48,
      render: (_, r) => <Avatar size="small" src={r.avatar} icon={<UserOutlined />} />,
    },
    {
      title: t("common.fullName"),
      dataIndex: "name",
      sorter: (a, b) => compareText(a.name, b.name),
      render: (name: string, record) => (
        <Button
          type="link"
          style={{ padding: 0, height: "auto", fontWeight: 500 }}
          onClick={() => openUser(record)}
        >
          {name}
        </Button>
      ),
    },
    {
      title: t("common.phone"),
      dataIndex: "phone",
      sorter: (a, b) => compareText(a.phone ?? "", b.phone ?? ""),
      render: (v?: string) => v || "—",
    },
    {
      title: t("common.email"),
      dataIndex: "email",
      sorter: (a, b) => compareText(a.email, b.email),
    },
    {
      title: t("user.dob"),
      dataIndex: "dateOfBirth",
      sorter: (a, b) => compareText(a.dateOfBirth ?? "", b.dateOfBirth ?? ""),
      render: (v?: string) => formatDob(v),
    },
    {
      title: t("common.address"),
      dataIndex: "address",
      ellipsis: true,
      render: (v?: string) =>
        v ? (
          <Tooltip title={v}>
            <span>{v}</span>
          </Tooltip>
        ) : (
          "—"
        ),
    },
    {
      title: t("common.role"),
      dataIndex: "role",
      sorter: (a, b) => compareText(getRoleLabel(a.role), getRoleLabel(b.role)),
      render: (r: UserRole, record) => (
        <Space size={4}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openRolePerms(r)}>
            <Tag color="blue">{getRoleLabel(r)}</Tag>
          </Button>
          {record.useCustomPermissions ? (
            <Tooltip title={t("user.customPermHint")}>
              <Tag color="orange">Custom</Tag>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: t("common.status"),
      dataIndex: "status",
      sorter: (a, b) => compareText(a.status, b.status),
      render: (s: string) => <StatusBadge module="user" status={s} />,
    },
  ];

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.users") }]}
        searchPlaceholder={t("common.searchTable")}
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: t("user.newCta"), onClick: openCreate }}
      />
      <DataTable<AppUser>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="users"
        emptyDescription={
          query.trim() && users.length > 0 ? t("common.noResults") : t("user.empty")
        }
        emptyAction={
          query.trim() && users.length > 0
            ? undefined
            : { label: t("common.createUser"), onClick: openCreate }
        }
      />

      <Modal
        title={editUser ? editUser.name : t("user.newTitle")}
        open={profileOpen}
        onCancel={closeProfile}
        footer={null}
        width={560}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}>
          {editUser ? t("user.editHint") : t("user.createHint")}
        </Typography.Paragraph>
        <UserProfileForm
          key={editUser?.id ?? "new"}
          user={
            editUser ?? {
              id: "",
              name: "",
              email: "",
              role: "staff",
              status: "active",
              authMethod: "email",
              createdAt: "",
            }
          }
          showRole
          showStatus={Boolean(editUser)}
          showCustomPermissions={Boolean(editUser)}
          roleOptions={roles}
          rolePermissionsLookup={rolePermissions}
          submitLabel={editUser ? t("common.save") : t("common.createUser")}
          loading={saving}
          onCancel={closeProfile}
          onSubmit={async (values) => {
            setSaving(true);
            try {
              if (editUser) {
                const updated = await identityAdminApi.updateUser(editUser.id, {
                  displayName: values.name,
                  phone: values.phone,
                  status: uiStatusToApi(values.status),
                });
                if (values.role && values.role !== editUser.role) {
                  await identityAdminApi.setUserRoles(editUser.id, uiRoleToApiCodes(values.role));
                }
                const mapped = mapIdentityUserToUi({
                  ...updated,
                  roleCodes: values.role ? uiRoleToApiCodes(values.role) : updated.roleCodes,
                });
                updateUser(editUser.id, {
                  ...mapped,
                  email: values.email,
                  dateOfBirth: values.dateOfBirth,
                  address: values.address,
                  avatar: values.avatar,
                  useCustomPermissions: values.useCustomPermissions,
                  customPermissions: values.useCustomPermissions
                    ? values.customPermissions
                    : undefined,
                });
                message.success(t("user.updated"));
              } else {
                const created = await identityAdminApi.createUser({
                  email: values.email,
                  displayName: values.name,
                  phone: values.phone,
                  status: "ACTIVE",
                  roleCodes: uiRoleToApiCodes(values.role ?? "staff"),
                });
                const mapped = mapIdentityUserToUi({
                  ...created,
                  roleCodes: created.roleCodes?.length
                    ? created.roleCodes
                    : uiRoleToApiCodes(values.role ?? "staff"),
                });
                createUser({
                  ...mapped,
                  id: created.id,
                  phone: values.phone,
                  dateOfBirth: values.dateOfBirth,
                  address: values.address,
                  avatar: values.avatar,
                  authMethod: "email",
                });
                message.success(t("user.created"));
              }
              closeProfile();
            } catch (err) {
              message.error(apiErrorMessage(err, t("user.empty")));
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>

      <Modal
        title={t("user.rolePerms")}
        open={!!permRole}
        onCancel={() => setPermRole(null)}
        width={640}
        centered
        okText={t("user.saveMatrix")}
        cancelText={t("common.cancel")}
        confirmLoading={savingPerms}
        onOk={() => {
          if (!permRole || !draftPerms) return;
          setSavingPerms(true);
          try {
            updateRolePermissions(permRole, draftPerms);
            message.success(t("user.savedPerms", { role: getRoleLabel(permRole) }));
            setPermRole(null);
          } finally {
            setSavingPerms(false);
          }
        }}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
          {t("user.rolePermsHint")}
        </Typography.Paragraph>

        <Space wrap style={{ width: "100%", marginBottom: 12 }} align="start">
          <Select
            style={{ minWidth: 220 }}
            value={permRole ?? undefined}
            options={roles.map((r) => ({
              value: r.key,
              label: r.builtin ? r.label : `${r.label} ${t("user.customSuffix")}`,
            }))}
            onChange={(key) => openRolePerms(key)}
          />
          {selectedRoleDef && !selectedRoleDef.builtin ? (
            <Popconfirm
              title={t("user.deleteRoleTitle", { label: selectedRoleDef.label })}
              description={t("user.deleteRoleBody")}
              okText={t("common.delete")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                const res = deleteRole(selectedRoleDef.key);
                if (!res.ok) {
                  message.warning(res.reason);
                  return;
                }
                message.success(t("user.roleDeleted"));
                setPermRole("staff");
              }}
            >
              <Button danger size="small">
                {t("user.deleteRole")}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>

        <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
          <Input
            placeholder={t("user.newRolePlaceholder")}
            value={newRoleLabel}
            onChange={(e) => setNewRoleLabel(e.target.value)}
            onPressEnter={async () => {
              if (!newRoleLabel.trim()) return;
              const created = createRole(newRoleLabel, permRole ?? "staff");
              try {
                await identityAdminApi.createRole({
                  code: created.key.toUpperCase(),
                  name: created.label,
                });
              } catch (err) {
                message.warning(apiErrorMessage(err, created.label));
              }
              message.success(t("user.roleCreated", { label: created.label }));
              setNewRoleLabel("");
              openRolePerms(created.key);
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={async () => {
              if (!newRoleLabel.trim()) {
                message.warning(t("user.enterRoleName"));
                return;
              }
              const created = createRole(newRoleLabel, permRole ?? "staff");
              try {
                await identityAdminApi.createRole({
                  code: created.key.toUpperCase(),
                  name: created.label,
                });
              } catch (err) {
                message.warning(apiErrorMessage(err, created.label));
              }
              message.success(t("user.roleCreated", { label: created.label }));
              setNewRoleLabel("");
              openRolePerms(created.key);
            }}
          >
            {t("user.addRole")}
          </Button>
        </Space.Compact>

        {draftPerms ? (
          <PermissionMatrix value={draftPerms} onChange={setDraftPerms} />
        ) : null}
      </Modal>
    </>
  );
}
