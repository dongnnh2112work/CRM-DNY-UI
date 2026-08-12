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
import { useEffect, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { useUsers } from "@/lib/users-store";

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
  const { message } = App.useApp();
  const {
    users,
    roles,
    createUser,
    updateUser,
    setUserStatus,
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
      title: "Họ tên",
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
      title: "SĐT",
      dataIndex: "phone",
      sorter: (a, b) => compareText(a.phone ?? "", b.phone ?? ""),
      render: (v?: string) => v || "—",
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a, b) => compareText(a.email, b.email),
    },
    {
      title: "Ngày sinh",
      dataIndex: "dateOfBirth",
      sorter: (a, b) => compareText(a.dateOfBirth ?? "", b.dateOfBirth ?? ""),
      render: (v?: string) => formatDob(v),
    },
    {
      title: "Địa chỉ",
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
      title: "Vai trò",
      dataIndex: "role",
      sorter: (a, b) => compareText(getRoleLabel(a.role), getRoleLabel(b.role)),
      render: (r: UserRole, record) => (
        <Space size={4}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={() => openRolePerms(r)}>
            <Tag color="blue">{getRoleLabel(r)}</Tag>
          </Button>
          {record.useCustomPermissions ? (
            <Tooltip title="Đang dùng phân quyền tùy chỉnh (ghi đè vai trò)">
              <Tag color="orange">Custom</Tag>
            </Tooltip>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sorter: (a, b) => compareText(a.status, b.status),
      render: (s: string) => <StatusBadge module="user" status={s} />,
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, record) => (
        <Popconfirm
          title={record.status === "active" ? "Vô hiệu hóa người dùng này?" : "Kích hoạt người dùng này?"}
          okText="Xác nhận"
          cancelText="Hủy"
          onConfirm={() => {
            setUserStatus(record.id, record.status === "active" ? "inactive" : "active");
            message.success("Đã cập nhật trạng thái");
          }}
        >
          <Button size="small" danger={record.status === "active"}>
            {record.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý người dùng" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Người dùng mới", onClick: openCreate }}
      />
      <DataTable<AppUser>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        emptyDescription={
          query.trim() && users.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có người dùng nào."
        }
        emptyAction={
          query.trim() && users.length > 0
            ? undefined
            : { label: "Thêm người dùng", onClick: openCreate }
        }
      />

      <Modal
        title={editUser ? editUser.name : "Người dùng mới"}
        open={profileOpen}
        onCancel={closeProfile}
        footer={null}
        width={560}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Typography.Paragraph type="secondary" style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}>
          {editUser
            ? "Xem và chỉnh sửa thông tin. Có thể bật phân quyền tùy chỉnh cho case đặc biệt."
            : "Điền thông tin để tạo người dùng mới."}
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
          submitLabel={editUser ? "Lưu thay đổi" : "Tạo người dùng"}
          loading={saving}
          onSubmit={async (values) => {
            setSaving(true);
            try {
              if (editUser) {
                updateUser(editUser.id, {
                  name: values.name,
                  email: values.email,
                  phone: values.phone,
                  dateOfBirth: values.dateOfBirth,
                  address: values.address,
                  avatar: values.avatar,
                  role: values.role,
                  status: values.status,
                  useCustomPermissions: values.useCustomPermissions,
                  customPermissions: values.useCustomPermissions
                    ? values.customPermissions
                    : undefined,
                });
                message.success("Đã cập nhật người dùng");
              } else {
                createUser({
                  name: values.name,
                  email: values.email,
                  phone: values.phone,
                  dateOfBirth: values.dateOfBirth,
                  address: values.address,
                  avatar: values.avatar,
                  role: values.role ?? "staff",
                  status: "active",
                  authMethod: "email",
                });
                message.success("Đã tạo người dùng");
              }
              closeProfile();
            } finally {
              setSaving(false);
            }
          }}
        />
      </Modal>

      <Modal
        title="Phân quyền theo vai trò"
        open={!!permRole}
        onCancel={() => setPermRole(null)}
        width={640}
        centered
        okText="Lưu ma trận"
        cancelText="Đóng"
        confirmLoading={savingPerms}
        onOk={() => {
          if (!permRole || !draftPerms) return;
          setSavingPerms(true);
          try {
            updateRolePermissions(permRole, draftPerms);
            message.success(`Đã lưu phân quyền ${getRoleLabel(permRole)}`);
            setPermRole(null);
          } finally {
            setSavingPerms(false);
          }
        }}
      >
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
          Chọn / thêm vai trò, rồi chỉnh <strong>Xem</strong> và <strong>Sửa</strong> theo từng trang.
          Bật Sửa sẽ tự bật Xem.
        </Typography.Paragraph>

        <Space wrap style={{ width: "100%", marginBottom: 12 }} align="start">
          <Select
            style={{ minWidth: 220 }}
            value={permRole ?? undefined}
            options={roles.map((r) => ({
              value: r.key,
              label: r.builtin ? r.label : `${r.label} (tùy chỉnh)`,
            }))}
            onChange={(key) => openRolePerms(key)}
          />
          {selectedRoleDef && !selectedRoleDef.builtin ? (
            <Popconfirm
              title={`Xóa vai trò “${selectedRoleDef.label}”?`}
              description="Chỉ xóa được khi không còn user nào dùng role này."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                const res = deleteRole(selectedRoleDef.key);
                if (!res.ok) {
                  message.warning(res.reason);
                  return;
                }
                message.success("Đã xóa vai trò");
                setPermRole("staff");
              }}
            >
              <Button danger size="small">
                Xóa vai trò
              </Button>
            </Popconfirm>
          ) : null}
        </Space>

        <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
          <Input
            placeholder="Tên vai trò mới (vd: Sales Lead)"
            value={newRoleLabel}
            onChange={(e) => setNewRoleLabel(e.target.value)}
            onPressEnter={() => {
              if (!newRoleLabel.trim()) return;
              const created = createRole(newRoleLabel, permRole ?? "staff");
              message.success(`Đã tạo vai trò ${created.label}`);
              setNewRoleLabel("");
              openRolePerms(created.key);
            }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              if (!newRoleLabel.trim()) {
                message.warning("Nhập tên vai trò");
                return;
              }
              const created = createRole(newRoleLabel, permRole ?? "staff");
              message.success(`Đã tạo vai trò ${created.label}`);
              setNewRoleLabel("");
              openRolePerms(created.key);
            }}
          >
            Thêm role
          </Button>
        </Space.Compact>

        {draftPerms ? (
          <PermissionMatrix value={draftPerms} onChange={setDraftPerms} />
        ) : null}
      </Modal>
    </>
  );
}
