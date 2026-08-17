"use client";

import {
  CalendarOutlined,
  IdcardOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import {
  App,
  Button,
  Col,
  Descriptions,
  Form,
  Input,
  Row,
  Space,
  Tabs,
  Tag,
  Typography,
  theme,
} from "antd";
import { useState, type CSSProperties, type ReactNode } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { ProfileAvatarUpload } from "@/components/users/profile-avatar-upload";
import { UserProfileForm } from "@/components/users/user-profile-form";
import { ds } from "@/lib/design-tokens";
import { useUsers } from "@/lib/users-store";

function formatDate(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function authMethodLabel(method: "google" | "email") {
  return method === "google" ? "Google" : "Email / mật khẩu";
}

function Surface({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const { token } = theme.useToken();
  return (
    <div
      style={{
        padding: 16,
        background: token.colorBgContainer,
        border: `1px solid ${token.colorBorder}`,
        borderRadius: token.borderRadiusLG,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Typography.Text
      strong
      style={{
        display: "block",
        marginBottom: 12,
        fontSize: ds.fontSize.bodySm,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: ds.inkMuted,
      }}
    >
      {children}
    </Typography.Text>
  );
}

export default function ProfilePage() {
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { currentUser, updateUser, getRoleLabel } = useUsers();
  const [saving, setSaving] = useState(false);

  if (!currentUser) {
    return (
      <EmptyState
        description="Bạn chưa đăng nhập."
        action={{ label: "Đăng nhập", href: "/login" }}
      />
    );
  }

  const roleLabel = getRoleLabel(currentUser.role);
  const phoneDisplay = currentUser.phone?.trim() || "Chưa có";
  const addressDisplay = currentUser.address?.trim() || "Chưa có";

  const updateAvatar = (next: string | undefined) => {
    updateUser(currentUser.id, { avatar: next });
    message.success(next ? "Đã cập nhật ảnh đại diện" : "Đã xóa ảnh đại diện");
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Thông tin cá nhân" }]} />

      <div style={{ padding: 16 }}>
        <Surface style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center" }}>
              <ProfileAvatarUpload
                avatar={currentUser.avatar}
                size={96}
                onChange={updateAvatar}
              />
              <div>
                <Typography.Title level={3} style={{ margin: 0, fontSize: ds.fontSize.h2 }}>
                  {currentUser.name}
                </Typography.Title>
                <Space wrap size={8} style={{ marginTop: 8 }}>
                  <Tag color="blue">{roleLabel}</Tag>
                  <StatusBadge module="user" status={currentUser.status} />
                  {currentUser.useCustomPermissions ? (
                    <Tag color="orange">Phân quyền tùy chỉnh</Tag>
                  ) : null}
                </Space>
                <Space
                  wrap
                  size={[16, 8]}
                  style={{ marginTop: 12, color: token.colorTextSecondary, fontSize: ds.fontSize.bodySm }}
                >
                  <span>
                    <MailOutlined style={{ marginRight: 6 }} />
                    {currentUser.email}
                  </span>
                  <span>
                    <PhoneOutlined style={{ marginRight: 6 }} />
                    {phoneDisplay}
                  </span>
                  <span>
                    <SafetyCertificateOutlined style={{ marginRight: 6 }} />
                    {authMethodLabel(currentUser.authMethod)}
                  </span>
                  <span>
                    <CalendarOutlined style={{ marginRight: 6 }} />
                    Tham gia {formatDate(currentUser.createdAt)}
                  </span>
                </Space>
              </div>
            </div>
          </div>
        </Surface>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Surface>
                <SectionTitle>Liên hệ</SectionTitle>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Email">{currentUser.email}</Descriptions.Item>
                  <Descriptions.Item label="SĐT">{phoneDisplay}</Descriptions.Item>
                  <Descriptions.Item label="Địa chỉ">{addressDisplay}</Descriptions.Item>
                </Descriptions>
              </Surface>

              <Surface>
                <SectionTitle>Vai trò & quyền</SectionTitle>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Vai trò">{roleLabel}</Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">
                    <StatusBadge module="user" status={currentUser.status} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Phân quyền">
                    {currentUser.useCustomPermissions
                      ? "Tùy chỉnh (ghi đè vai trò)"
                      : "Theo ma trận vai trò"}
                  </Descriptions.Item>
                </Descriptions>
              </Surface>

              <Surface>
                <SectionTitle>Tài khoản</SectionTitle>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="Đăng nhập">
                    {authMethodLabel(currentUser.authMethod)}
                  </Descriptions.Item>
                  <Descriptions.Item label="Ngày tạo">
                    {formatDate(currentUser.createdAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="ID">
                    <Typography.Text code style={{ fontSize: ds.fontSize.caption }}>
                      {currentUser.id}
                    </Typography.Text>
                  </Descriptions.Item>
                </Descriptions>
              </Surface>
            </Space>
          </Col>

          <Col xs={24} lg={16}>
            <Surface>
              <Tabs
                items={[
                  {
                    key: "personal",
                    label: (
                      <span>
                        <IdcardOutlined /> Thông tin cá nhân
                      </span>
                    ),
                    children: (
                      <div style={{ maxWidth: 480, paddingTop: 8 }}>
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}
                        >
                          Cập nhật thông tin liên hệ. Ảnh đại diện chỉnh ở phần đầu trang.
                        </Typography.Paragraph>
                        <UserProfileForm
                          key={currentUser.id}
                          user={currentUser}
                          showAvatar={false}
                          submitLabel="Lưu"
                          loading={saving}
                          onSubmit={async (values) => {
                            setSaving(true);
                            try {
                              updateUser(currentUser.id, {
                                name: values.name,
                                email: values.email,
                                phone: values.phone,
                                dateOfBirth: values.dateOfBirth,
                                address: values.address,
                              });
                              message.success("Đã cập nhật thông tin");
                            } finally {
                              setSaving(false);
                            }
                          }}
                        />
                      </div>
                    ),
                  },
                  {
                    key: "account",
                    label: (
                      <span>
                        <SafetyCertificateOutlined /> Tài khoản
                      </span>
                    ),
                    children: (
                      <div style={{ paddingTop: 8 }}>
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}
                        >
                          Thông tin tài khoản chỉ xem. Vai trò và trạng thái do quản trị viên quản lý.
                        </Typography.Paragraph>
                        <Descriptions
                          bordered
                          size="small"
                          column={1}
                          labelStyle={{ width: 160 }}
                        >
                          <Descriptions.Item label="Họ tên">{currentUser.name}</Descriptions.Item>
                          <Descriptions.Item label="Email">{currentUser.email}</Descriptions.Item>
                          <Descriptions.Item label="Vai trò">{roleLabel}</Descriptions.Item>
                          <Descriptions.Item label="Trạng thái">
                            <StatusBadge module="user" status={currentUser.status} />
                          </Descriptions.Item>
                          <Descriptions.Item label="Phương thức đăng nhập">
                            {authMethodLabel(currentUser.authMethod)}
                          </Descriptions.Item>
                          <Descriptions.Item label="Phân quyền tùy chỉnh">
                            {currentUser.useCustomPermissions ? "Đang bật" : "Không"}
                          </Descriptions.Item>
                          <Descriptions.Item label="Ngày tạo tài khoản">
                            {formatDate(currentUser.createdAt)}
                          </Descriptions.Item>
                        </Descriptions>
                      </div>
                    ),
                  },
                  {
                    key: "security",
                    label: (
                      <span>
                        <LockOutlined /> Bảo mật
                      </span>
                    ),
                    children: (
                      <div style={{ maxWidth: 420, paddingTop: 8 }}>
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}
                        >
                          Bạn đang đăng nhập bằng{" "}
                          <Typography.Text strong>
                            {authMethodLabel(currentUser.authMethod)}
                          </Typography.Text>
                          . Đổi mật khẩu sẽ kết nối SSO/backend khi hệ thống sẵn sàng.
                        </Typography.Paragraph>
                        <Form
                          layout="vertical"
                          onFinish={() => {
                            message.info("Chức năng đổi mật khẩu sẽ kết nối SSO/backend.");
                          }}
                        >
                          <Form.Item
                            name="currentPassword"
                            label="Mật khẩu hiện tại"
                            rules={[{ required: true, message: "Nhập mật khẩu hiện tại" }]}
                          >
                            <Input.Password
                              disabled={currentUser.authMethod === "google"}
                              placeholder={
                                currentUser.authMethod === "google"
                                  ? "Tài khoản Google — không dùng mật khẩu"
                                  : "••••••••"
                              }
                            />
                          </Form.Item>
                          <Form.Item
                            name="newPassword"
                            label="Mật khẩu mới"
                            rules={[{ required: true, message: "Nhập mật khẩu mới" }]}
                          >
                            <Input.Password
                              disabled={currentUser.authMethod === "google"}
                              placeholder="••••••••"
                            />
                          </Form.Item>
                          <Form.Item
                            name="confirmPassword"
                            label="Xác nhận mật khẩu mới"
                            dependencies={["newPassword"]}
                            rules={[
                              { required: true, message: "Xác nhận mật khẩu mới" },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  if (!value || getFieldValue("newPassword") === value) {
                                    return Promise.resolve();
                                  }
                                  return Promise.reject(new Error("Mật khẩu không khớp"));
                                },
                              }),
                            ]}
                          >
                            <Input.Password
                              disabled={currentUser.authMethod === "google"}
                              placeholder="••••••••"
                            />
                          </Form.Item>
                          <Button
                            type="primary"
                            htmlType="submit"
                            disabled={currentUser.authMethod === "google"}
                          >
                            Đổi mật khẩu
                          </Button>
                        </Form>
                      </div>
                    ),
                  },
                ]}
              />
            </Surface>
          </Col>
        </Row>
      </div>
    </>
  );
}
