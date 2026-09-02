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
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";

function formatDate(iso?: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function authMethodLabel(method: "google" | "email", t: ReturnType<typeof useT>) {
  return method === "google" ? "Google" : t("profile.authEmailPassword");
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
  const t = useT();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { currentUser, updateUser, getRoleLabel } = useUsers();
  const [saving, setSaving] = useState(false);

  if (!currentUser) {
    return (
      <EmptyState
        description={t("common.notLoggedIn")}
        action={{ label: t("common.login"), href: "/login" }}
      />
    );
  }

  const roleLabel = getRoleLabel(currentUser.role);
  const phoneDisplay = currentUser.phone?.trim() || t("common.none");
  const addressDisplay = currentUser.address?.trim() || t("common.none");

  const updateAvatar = (next: string | undefined) => {
    updateUser(currentUser.id, { avatar: next });
    message.success(next ? t("profile.avatarUpdated") : t("profile.avatarRemoved"));
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("profile.title") }]} />

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
                    <Tag color="orange">{t("profile.customPerms")}</Tag>
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
                    {authMethodLabel(currentUser.authMethod, t)}
                  </span>
                  <span>
                    <CalendarOutlined style={{ marginRight: 6 }} />
                    {t("profile.joined")} {formatDate(currentUser.createdAt)}
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
                <SectionTitle>{t("profile.contact")}</SectionTitle>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t("common.email")}>{currentUser.email}</Descriptions.Item>
                  <Descriptions.Item label={t("common.phone")}>{phoneDisplay}</Descriptions.Item>
                  <Descriptions.Item label={t("common.address")}>{addressDisplay}</Descriptions.Item>
                </Descriptions>
              </Surface>

              <Surface>
                <SectionTitle>{t("profile.roleAndPerms")}</SectionTitle>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t("common.role")}>{roleLabel}</Descriptions.Item>
                  <Descriptions.Item label={t("common.status")}>
                    <StatusBadge module="user" status={currentUser.status} />
                  </Descriptions.Item>
                  <Descriptions.Item label={t("profile.permissions")}>
                    {currentUser.useCustomPermissions
                      ? t("profile.customOverride")
                      : t("profile.fromRoleMatrix")}
                  </Descriptions.Item>
                </Descriptions>
              </Surface>

              <Surface>
                <SectionTitle>{t("profile.account")}</SectionTitle>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label={t("profile.loginMethod")}>
                    {authMethodLabel(currentUser.authMethod, t)}
                  </Descriptions.Item>
                  <Descriptions.Item label={t("common.createdAt")}>
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
                        <IdcardOutlined /> {t("profile.personalTab")}
                      </span>
                    ),
                    children: (
                      <div style={{ maxWidth: 480, paddingTop: 8 }}>
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}
                        >
                          {t("profile.contactHint")}
                        </Typography.Paragraph>
                        <UserProfileForm
                          key={currentUser.id}
                          user={currentUser}
                          showAvatar={false}
                          submitLabel={t("common.save")}
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
                              message.success(t("profile.updated"));
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
                        <SafetyCertificateOutlined /> {t("profile.account")}
                      </span>
                    ),
                    children: (
                      <div style={{ paddingTop: 8 }}>
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}
                        >
                          {t("profile.accountReadOnlyHint")}
                        </Typography.Paragraph>
                        <Descriptions
                          bordered
                          size="small"
                          column={1}
                          labelStyle={{ width: 160 }}
                        >
                          <Descriptions.Item label={t("common.fullName")}>{currentUser.name}</Descriptions.Item>
                          <Descriptions.Item label={t("common.email")}>{currentUser.email}</Descriptions.Item>
                          <Descriptions.Item label={t("common.role")}>{roleLabel}</Descriptions.Item>
                          <Descriptions.Item label={t("common.status")}>
                            <StatusBadge module="user" status={currentUser.status} />
                          </Descriptions.Item>
                          <Descriptions.Item label={t("profile.loginMethodLabel")}>
                            {authMethodLabel(currentUser.authMethod, t)}
                          </Descriptions.Item>
                          <Descriptions.Item label={t("profile.customPerms")}>
                            {currentUser.useCustomPermissions ? t("profile.on") : t("common.no")}
                          </Descriptions.Item>
                          <Descriptions.Item label={t("profile.accountCreated")}>
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
                        <LockOutlined /> {t("profile.securityTab")}
                      </span>
                    ),
                    children: (
                      <div style={{ maxWidth: 420, paddingTop: 8 }}>
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 0, fontSize: ds.fontSize.bodySm }}
                        >
                          {t("profile.securityHint", {
                            method: authMethodLabel(currentUser.authMethod, t),
                          })}
                        </Typography.Paragraph>
                        <Form
                          layout="vertical"
                          onFinish={() => {
                            message.info(t("profile.passwordHint"));
                          }}
                        >
                          <Form.Item
                            name="currentPassword"
                            label={t("profile.currentPassword")}
                            rules={[{ required: true, message: t("profile.enterCurrentPassword") }]}
                          >
                            <Input.Password
                              disabled={currentUser.authMethod === "google"}
                              placeholder={
                                currentUser.authMethod === "google"
                                  ? t("profile.googleNoPassword")
                                  : "••••••••"
                              }
                            />
                          </Form.Item>
                          <Form.Item
                            name="newPassword"
                            label={t("profile.newPassword")}
                            rules={[{ required: true, message: t("profile.enterNewPassword") }]}
                          >
                            <Input.Password
                              disabled={currentUser.authMethod === "google"}
                              placeholder="••••••••"
                            />
                          </Form.Item>
                          <Form.Item
                            name="confirmPassword"
                            label={t("profile.confirmPassword")}
                            dependencies={["newPassword"]}
                            rules={[
                              { required: true, message: t("profile.confirmPassword") },
                              ({ getFieldValue }) => ({
                                validator(_, value) {
                                  if (!value || getFieldValue("newPassword") === value) {
                                    return Promise.resolve();
                                  }
                                  return Promise.reject(new Error(t("profile.passwordMismatch")));
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
                            {t("profile.changePassword")}
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
