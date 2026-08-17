"use client";

import { UploadOutlined, UserOutlined } from "@ant-design/icons";
import {
  App,
  Avatar,
  Button,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Typography,
  Upload,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useState } from "react";
import { PermissionMatrix } from "@/components/users/permission-matrix";
import { ds } from "@/lib/design-tokens";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import {
  emptyPagePermissions,
  type AppUser,
  type RoleDefinition,
  type RolePagePermissions,
  type UserRole,
  type UserStatus,
} from "@/lib/types";

export type UserProfileFormValues = {
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: Dayjs | null;
  address?: string;
  role?: UserRole;
  status?: UserStatus;
  avatar?: string;
  useCustomPermissions?: boolean;
};

export function UserProfileForm({
  user,
  onSubmit,
  submitLabel = "Lưu",
  showAvatar = true,
  showRole = false,
  showStatus = false,
  showCustomPermissions = false,
  roleOptions = [],
  rolePermissionsLookup,
  loading = false,
  onCancel,
}: {
  user?: AppUser | null;
  onSubmit: (values: {
    name: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    address?: string;
    role?: UserRole;
    status?: UserStatus;
    avatar?: string;
    useCustomPermissions?: boolean;
    customPermissions?: RolePagePermissions;
  }) => void | Promise<void>;
  submitLabel?: string;
  /** When false, avatar block is hidden (e.g. profile page hero handles it). */
  showAvatar?: boolean;
  showRole?: boolean;
  showStatus?: boolean;
  /** Admin-only: allow per-user View/Edit override */
  showCustomPermissions?: boolean;
  roleOptions?: RoleDefinition[];
  /** Used to seed custom matrix from selected role */
  rolePermissionsLookup?: Record<string, RolePagePermissions>;
  loading?: boolean;
  onCancel?: () => void;
}) {
  const { modal } = App.useApp();
  const [form] = Form.useForm<UserProfileFormValues>();
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [useCustom, setUseCustom] = useState(Boolean(user?.useCustomPermissions));
  const [customPerms, setCustomPerms] = useState<RolePagePermissions>(
    () => user?.customPermissions ?? emptyPagePermissions(),
  );

  useEffect(() => {
    form.setFieldsValue({
      name: user?.name,
      email: user?.email,
      phone: user?.phone,
      dateOfBirth: user?.dateOfBirth ? dayjs(user.dateOfBirth) : null,
      address: user?.address,
      role: user?.role,
      status: user?.status,
      avatar: user?.avatar,
      useCustomPermissions: Boolean(user?.useCustomPermissions),
    });
    setAvatar(user?.avatar);
    setUseCustom(Boolean(user?.useCustomPermissions));
    setCustomPerms(user?.customPermissions ?? emptyPagePermissions());
  }, [user, form]);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const seedFromRole = (roleKey?: string) => {
    if (!roleKey || !rolePermissionsLookup?.[roleKey]) return;
    setCustomPerms(structuredClone(rolePermissionsLookup[roleKey]));
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        await onSubmit({
          name: values.name,
          email: values.email,
          phone: values.phone?.trim() || undefined,
          dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format("YYYY-MM-DD") : undefined,
          address: values.address?.trim() || undefined,
          role: values.role,
          status: values.status,
          ...(showAvatar ? { avatar } : {}),
          useCustomPermissions: showCustomPermissions ? useCustom : undefined,
          customPermissions: showCustomPermissions && useCustom ? customPerms : undefined,
        });
      }}
    >
      {showAvatar ? (
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <Avatar size={64} src={avatar} icon={<UserOutlined />} />
          <Space direction="vertical" size={4}>
            <Upload
              accept="image/*"
              showUploadList={false}
              beforeUpload={async (file) => {
                const dataUrl = await readFileAsDataUrl(file);
                setAvatar(dataUrl);
                form.setFieldValue("avatar", dataUrl);
                return false;
              }}
            >
              <Button icon={<UploadOutlined />} size="small">
                Tải ảnh đại diện
              </Button>
            </Upload>
            {avatar ? (
              <Button
                type="link"
                size="small"
                danger
                style={{ padding: 0 }}
                onClick={() => {
                  setAvatar(undefined);
                  form.setFieldValue("avatar", undefined);
                }}
              >
                Xóa ảnh
              </Button>
            ) : null}
          </Space>
        </div>
      ) : null}

      <Form.Item name="name" label="Họ tên" rules={[{ required: true, message: "Nhập họ tên" }]}>
        <Input placeholder="Họ và tên" />
      </Form.Item>
      <Form.Item
        name="phone"
        label="SĐT"
        rules={[
          {
            validator: async (_, value) => {
              if (!value || !String(value).trim()) return;
              if (!/^[0-9+\s()-]{8,15}$/.test(String(value).trim())) {
                throw new Error("SĐT không hợp lệ");
              }
            },
          },
        ]}
      >
        <Input placeholder="Số điện thoại" />
      </Form.Item>
      <Form.Item
        name="email"
        label="Email"
        rules={[
          { required: true, message: "Nhập email" },
          { type: "email", message: "Email không hợp lệ" },
        ]}
      >
        <Input placeholder="Email" />
      </Form.Item>
      <Form.Item name="dateOfBirth" label="Ngày sinh">
        <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" placeholder="Chọn ngày sinh" />
      </Form.Item>
      <Form.Item name="address" label="Địa chỉ">
        <Input.TextArea rows={2} placeholder="Địa chỉ" />
      </Form.Item>

      {showRole ? (
        <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: "Chọn vai trò" }]}>
          <Select
            options={roleOptions.map((r) => ({
              value: r.key,
              label: r.builtin ? r.label : `${r.label} (tùy chỉnh)`,
            }))}
            onChange={(roleKey) => {
              if (useCustom) seedFromRole(roleKey);
            }}
          />
        </Form.Item>
      ) : null}
      {showStatus ? (
        <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "active", label: "Hoạt động" },
              { value: "inactive", label: "Ngừng" },
            ]}
          />
        </Form.Item>
      ) : null}

      {showCustomPermissions ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: 8,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <Typography.Text strong>Phân quyền tùy chỉnh</Typography.Text>
              <Typography.Paragraph
                type="secondary"
                style={{ margin: "4px 0 0", fontSize: ds.fontSize.caption }}
              >
                Bật để ghi đè ma trận Xem/Sửa của vai trò — dùng cho case đặc biệt.
              </Typography.Paragraph>
            </div>
            <Switch
              checked={useCustom}
              onChange={(checked) => {
                setUseCustom(checked);
                if (checked && !user?.customPermissions) {
                  seedFromRole(form.getFieldValue("role") ?? user?.role);
                }
              }}
            />
          </div>
          {useCustom ? (
            <div style={{ marginTop: 12 }}>
              <Space style={{ marginBottom: 8 }}>
                <Button
                  size="small"
                  onClick={() => seedFromRole(form.getFieldValue("role") ?? user?.role)}
                >
                  Sao chép từ vai trò
                </Button>
              </Space>
              <PermissionMatrix value={customPerms} onChange={setCustomPerms} />
            </div>
          ) : null}
        </div>
      ) : null}

      <Space>
        {onCancel ? (
          <Button onClick={() => confirmDiscardIfDirty(modal, form, onCancel)} disabled={loading}>
            Hủy
          </Button>
        ) : null}
        <Button type="primary" htmlType="submit" loading={loading} disabled={loading}>
          {submitLabel}
        </Button>
      </Space>
    </Form>
  );
}
