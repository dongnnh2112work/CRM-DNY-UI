"use client";

import { GoogleOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Button, Divider, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { ds } from "@/lib/design-tokens";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: ds.canvasSoft,
        padding: 24,
      }}
    >
      <div
        style={{
          width: 400,
          background: ds.surface,
          border: `1px solid ${ds.hairline}`,
          borderRadius: ds.radius.xl,
          boxShadow: ds.shadow,
          padding: 32,
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Typography.Title
            level={3}
            style={{ margin: 0, color: ds.ink, fontWeight: 700, letterSpacing: "-0.5px" }}
          >
            DNY CRM
          </Typography.Title>
          <Typography.Text style={{ color: ds.inkMuted }}>Hệ thống quản lý dịch vụ pháp lý</Typography.Text>
        </div>

        <Button
          size="large"
          block
          style={{
            marginBottom: 16,
            height: 40,
            background: ds.surface,
            borderColor: ds.hairline,
            color: ds.ink,
            fontWeight: 500,
            borderRadius: ds.radius.full,
          }}
          icon={<GoogleOutlined />}
          onClick={() => router.push("/dashboard")}
        >
          Đăng nhập bằng Google
        </Button>

        <Divider plain style={{ borderColor: ds.hairline, color: ds.inkFaint }}>
          hoặc đăng nhập bằng email
        </Divider>

        <Form layout="vertical" onFinish={() => router.push("/dashboard")} requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, type: "email", message: "Vui lòng nhập email" }]}>
            <Input prefix={<MailOutlined style={{ color: ds.inkFaint }} />} placeholder="Email" size="large" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: "Vui lòng nhập mật khẩu" }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: ds.inkFaint }} />}
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
