"use client";

import { GoogleOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Divider, Form, Input, Typography, theme } from "antd";
import { useRouter } from "next/navigation";
import { useUsers } from "@/lib/users-store";
import { useT } from "@/lib/use-t";

const DEFAULT_LOGIN_USER_ID = "u2";

export default function LoginPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { loginAs } = useUsers();
  const t = useT();

  const enterApp = () => {
    loginAs(DEFAULT_LOGIN_USER_ID);
    router.push("/dashboard");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: token.colorBgLayout,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 400,
          background: token.colorBgContainer,
          border: `1px solid ${token.colorBorder}`,
          borderRadius: token.borderRadiusLG,
          boxShadow: token.boxShadow,
          padding: 32,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Typography.Title level={3} style={{ margin: 0, fontWeight: 700, letterSpacing: "-0.5px" }}>
            DNY CRM
          </Typography.Title>
          <Typography.Text type="secondary">{t("auth.tagline")}</Typography.Text>
        </div>

        <Button
          size="large"
          block
          style={{
            marginBottom: 16,
            height: 40,
            fontWeight: 500,
            borderRadius: 9999,
          }}
          icon={<GoogleOutlined />}
          onClick={enterApp}
        >
          {t("auth.loginGoogle")}
        </Button>

        <Divider plain style={{ borderColor: token.colorBorder, color: token.colorTextTertiary }}>
          {t("auth.orEmail")}
        </Divider>

        <Form layout="vertical" onFinish={enterApp} requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, type: "email", message: t("auth.emailRequired") }]}>
            <Input
              prefix={<MailOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder={t("auth.email")}
              size="large"
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: t("auth.passwordRequired") }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder={t("auth.password")}
              size="large"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            {t("auth.login")}
          </Button>
        </Form>
      </div>
    </div>
  );
}
