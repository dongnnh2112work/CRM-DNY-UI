"use client";

import { GoogleOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Checkbox, Drawer, Form, Input, Modal, Select, Space, Table, Tag, type TableColumnsType } from "antd";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_USERS } from "@/lib/mock-users";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, type AppUser, type Permission, type UserRole } from "@/lib/types";

const USER_STATUS_LABELS: Record<string, string> = {
  active: "Hoạt động",
  inactive: "Ngừng",
};

export default function UsersPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [permDrawer, setPermDrawer] = useState<UserRole | null>(null);
  const [query, setQuery] = useState("");
  const [form] = Form.useForm();

  const filtered = users.filter((u) =>
    [u.name, u.email, u.role].some((f) => f.toLowerCase().includes(query.toLowerCase())),
  );

  const handleSave = (values: Record<string, string>) => {
    if (editUser) {
      setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...values } as AppUser : u)));
    } else {
      const newUser: AppUser = {
        id: `u${Date.now()}`,
        name: values.name,
        email: values.email,
        role: values.role as UserRole,
        status: "active",
        authMethod: "email",
        createdAt: new Date().toISOString().slice(0, 10),
      };
      setUsers((prev) => [...prev, newUser]);
    }
    setDrawerOpen(false);
    setEditUser(null);
    form.resetFields();
  };

  const openEdit = (user: AppUser) => {
    setEditUser(user);
    form.setFieldsValue(user);
    setDrawerOpen(true);
  };

  const toggleStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: u.status === "active" ? "inactive" : "active" } : u)),
    );
  };

  const columns: TableColumnsType<AppUser> = [
    { title: "Tên", dataIndex: "name" },
    { title: "Email", dataIndex: "email" },
    {
      title: "Vai trò",
      dataIndex: "role",
      render: (r: UserRole) => (
        <Tag color="blue" style={{ cursor: "pointer" }} onClick={() => setPermDrawer(r)}>
          {ROLE_LABELS[r]}
        </Tag>
      ),
    },
    {
      title: "Đăng nhập",
      dataIndex: "authMethod",
      render: (m: string) => m === "google" ? <GoogleOutlined style={{ color: "#4285f4" }} /> : <MailOutlined />,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (s: string) => <Tag color={s === "active" ? "success" : "default"}>{USER_STATUS_LABELS[s] ?? s}</Tag>,
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>Sửa</Button>
          <Button size="small" danger={record.status === "active"} onClick={() => toggleStatus(record.id)}>
            {record.status === "active" ? "Vô hiệu hóa" : "Kích hoạt"}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý người dùng" }]}
        searchPlaceholder="Tìm người dùng…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Người dùng mới", href: "#" }}
      >
        <Button type="primary" onClick={() => { setEditUser(null); form.resetFields(); setDrawerOpen(true); }}>
          + Người dùng mới
        </Button>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </div>

      <Drawer title={editUser ? "Sửa người dùng" : "Người dùng mới"} open={drawerOpen} onClose={() => { setDrawerOpen(false); setEditUser(null); }} width={420}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Vai trò" rules={[{ required: true }]}>
            <Select options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            {editUser ? "Lưu thay đổi" : "Tạo người dùng"}
          </Button>
        </Form>
      </Drawer>

      <Modal title={`Quyền: ${permDrawer ? ROLE_LABELS[permDrawer] : ""}`} open={!!permDrawer} onCancel={() => setPermDrawer(null)} footer={null}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
          {PERMISSIONS.map((p) => (
            <Checkbox key={p} checked={permDrawer ? ROLE_PERMISSIONS[permDrawer].includes(p as Permission) : false} disabled>
              {p}
            </Checkbox>
          ))}
        </div>
      </Modal>
    </>
  );
}
