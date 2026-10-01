"use client";

import { UserOutlined } from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  Modal,
  Space,
  Tag,
  Tooltip,
  Typography,
  type TableColumnsType,
} from "antd";
import { useCallback, useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { RolePermissionGroupsAdmin } from "@/components/users/role-permission-groups-modal";
import { UserProfileForm } from "@/components/users/user-profile-form";
import { ds } from "@/lib/design-tokens";
import { type AppUser, type UserRole } from "@/lib/types";
import { getStatusMeta } from "@/lib/status-config";
import { isInDateRange, type DateRangeValue } from "@/lib/date-range";
import { formatDisplayDate } from "@/lib/format-date";
import { matchesTableQuery } from "@/lib/table-search";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useRemoteList } from "@/components/api-hydrator";
import { useT } from "@/lib/use-t";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { identityAdminApi } from "@/modules/identity-admin/api";
import {
  mapIdentityUserToUi,
  roleCodesEqual,
  uiRoleToApiCodes,
  uiStatusToApi,
  unwrapIdentityEntity,
} from "@/modules/identity-admin/map-to-ui";
import type { IdentityUser } from "@/modules/identity-admin/api";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function UsersPage() {
  const t = useT();
  const { message } = App.useApp();
  const { can, user: apiUser, refreshMe } = useSession();
  const {
    users,
    roles,
    createUser,
    updateUser,
    rolePermissions,
    getRoleLabel,
  } = useUsers();
  const usersRemote = useRemoteList("users");
  const [profileOpen, setProfileOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [permRole, setPermRole] = useState<UserRole | null>(null);
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
  }, []);
  const [saving, setSaving] = useState(false);

  const filtered = users.filter((u) => {
    if (dateRange?.[0] || dateRange?.[1]) {
      if (!isInDateRange(u.createdAt, dateRange)) return false;
    }
    return matchesTableQuery(query, [
      u.name,
      u.email,
      u.phone,
      u.dateOfBirth,
      formatDisplayDate(u.dateOfBirth),
      u.address,
      u.role,
      getRoleLabel(u.role),
      u.status,
      getStatusMeta("user", u.status).label,
      u.authMethod,
      u.useCustomPermissions ? "custom" : null,
    ]);
  });

  const openCreate = () => {
    setEditUser(null);
    setProfileOpen(true);
  };

  const openUser = async (user: AppUser) => {
    setEditUser(user);
    setProfileOpen(true);
    try {
      const raw = await identityAdminApi.getUser(user.id);
      const detail = unwrapIdentityEntity<IdentityUser>(raw) ?? raw;
      const mapped = mapIdentityUserToUi(detail);
      setEditUser({
        ...user,
        ...mapped,
        email: mapped.email || user.email,
        phone: mapped.phone ?? user.phone,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        avatar: user.avatar,
      });
      updateUser(user.id, {
        role: mapped.role,
        roleCodes: mapped.roleCodes,
        status: mapped.status,
        name: mapped.name,
      });
    } catch {
      // Keep list row if detail fetch fails — save may still work with selected role.
    }
  };

  const closeProfile = () => {
    setProfileOpen(false);
    setEditUser(null);
  };

  const openRolePerms = (roleKey: UserRole) => {
    setPermRole(roleKey);
  };

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
      render: (v?: string) => formatDisplayDate(v),
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
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        primaryAction={{ label: t("user.newCta"), onClick: openCreate }}
      >
        {can(PERMISSION.roleManage) || can(PERMISSION.permissionManage) ? (
          <Link href="/users/permissions">
            <Button>{t("nav.permissions")}</Button>
          </Link>
        ) : null}
        {can("user.manage") ? (
          <Link href="/users/pending">
            <Button>{t("nav.pendingUsers")}</Button>
          </Link>
        ) : null}
      </PageHeader>
      <DataTable<AppUser>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="users"
        remote={usersRemote}
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
                const nextRoleCodes = values.role
                  ? uiRoleToApiCodes(values.role)
                  : (editUser.roleCodes ?? uiRoleToApiCodes(editUser.role));
                const prevRoleCodes = editUser.roleCodes ?? uiRoleToApiCodes(editUser.role);
                if (!roleCodesEqual(prevRoleCodes, nextRoleCodes)) {
                  await identityAdminApi.setUserRoles(editUser.id, nextRoleCodes);
                  if (apiUser?.id === editUser.id) await refreshMe();
                  else message.info(t("user.refreshSessionHint"));
                }
                const mapped = mapIdentityUserToUi({
                  ...updated,
                  roleCodes: nextRoleCodes,
                });
                updateUser(editUser.id, {
                  ...mapped,
                  roleCodes: nextRoleCodes,
                  email: values.email,
                  dateOfBirth: values.dateOfBirth,
                  address: values.address,
                  avatar: values.avatar,
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
        title={t("user.roleGroups")}
        open={!!permRole}
        onCancel={() => setPermRole(null)}
        footer={null}
        width={720}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        {permRole ? <RolePermissionGroupsAdmin embedded initialUiRole={permRole} /> : null}
      </Modal>
    </>
  );
}
