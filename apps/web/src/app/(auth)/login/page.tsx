"use client";

import { GoogleOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Divider, Form, Input, Typography, theme } from "antd";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const { token } = theme.useToken();

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
          <Typography.Text type="secondary">Hệ thống quản lý dịch vụ pháp lý</Typography.Text>
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
          onClick={() => router.push("/dashboard")}
        >
          Đăng nhập bằng Google
        </Button>

        <Divider plain style={{ borderColor: token.colorBorder, color: token.colorTextTertiary }}>
          hoặc đăng nhập bằng email
        </Divider>

        <Form layout="vertical" onFinish={() => router.push("/dashboard")} requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, type: "email", message: "Vui lòng nhập email" }]}>
            <Input
              prefix={<MailOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Email"
              size="large"
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder="Mật khẩu"
              size="large"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block>
            Đăng nhập
          </Button>
        </Form>
      </div>
    </div>
  );
}
