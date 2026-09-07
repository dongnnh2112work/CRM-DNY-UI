"use client";

import { GoogleOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, App, Button, Divider, Form, Input, Typography, theme } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageLoading } from "@/components/shared/page-loading";
import { ApiError } from "@/lib/http/errors";
import { clearOAuthRedirectParams, clearRememberedOAuthError, readOAuthRedirectError } from "@/lib/http/oauth-redirect";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { authApi } from "@/modules/auth/api";

export default function LoginPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { status, applySession } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [hashReady, setHashReady] = useState(false);

  useEffect(() => {
    const apply = () => {
      const fromRedirect = readOAuthRedirectError();
      if (fromRedirect) {
        setOauthError(fromRedirect);
        clearOAuthRedirectParams();
      }
      setHashReady(true);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (!hashReady || oauthError) return;
    if (status === "authenticated") router.replace("/dashboard");
  }, [hashReady, oauthError, status, router]);

  const onGoogle = () => {
    clearRememberedOAuthError();
    setOauthError(null);
    setGooglePending(true);
    authApi.loginWithGoogle();
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setSubmitting(true);
    setFormError(null);
    try {
      const session = await authApi.login(values.email, values.password);
      clearRememberedOAuthError();
      applySession(session);
      router.replace("/dashboard");
    } catch (err) {
      const msg = err instanceof ApiError ? err.messages.join(" ") : t("auth.loginFailed");
      setFormError(msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hashReady || (status === "loading" && !oauthError) || (status === "authenticated" && !oauthError)) {
    return <PageLoading />;
  }

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

        {oauthError || formError ? (
          <Alert
            type="error"
            showIcon
            title={oauthError ? t("auth.callbackError") : undefined}
            description={oauthError ?? formError}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        <Button
          size="large"
          block
          loading={googlePending}
          style={{
            marginBottom: 16,
            height: 40,
            fontWeight: 500,
            borderRadius: 9999,
          }}
          icon={<GoogleOutlined />}
          onClick={onGoogle}
        >
          {t("auth.loginGoogle")}
        </Button>

        <Divider plain style={{ borderColor: token.colorBorder, color: token.colorTextTertiary }}>
          {t("auth.orEmail")}
        </Divider>

        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="email" rules={[{ required: true, type: "email", message: t("auth.emailRequired") }]}>
            <Input
              prefix={<MailOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder={t("auth.email")}
              size="large"
              autoComplete="email"
            />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: t("auth.passwordRequired") }]}>
            <Input.Password
              prefix={<LockOutlined style={{ color: token.colorTextTertiary }} />}
              placeholder={t("auth.password")}
              size="large"
              autoComplete="current-password"
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            {t("auth.login")}
          </Button>
        </Form>
      </div>
    </div>
  );
}
