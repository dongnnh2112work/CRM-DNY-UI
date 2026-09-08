"use client";

import { GoogleOutlined, LockOutlined, MailOutlined } from "@ant-design/icons";
import { Alert, App, Button, Divider, Form, Input, Typography, theme } from "antd";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageLoading } from "@/components/shared/page-loading";
import { destinationForUser } from "@/lib/access-gate";
import { isDevDebugEnabled } from "@/lib/dev-debug";
import { consumeAuthNotice, type AuthNotice, type AuthNoticeKind } from "@/lib/http/auth-notice";
import { classifyApiError, classifyOAuthError } from "@/lib/http/error-kind";
import { ApiError } from "@/lib/http/errors";
import {
  clearOAuthRedirectParams,
  clearRememberedOAuthError,
  readOAuthHashParams,
  readOAuthRedirectError,
} from "@/lib/http/oauth-redirect";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { authApi } from "@/modules/auth/api";

function noticeCopyKey(kind: AuthNoticeKind) {
  if (kind === "oauth_denied") return "auth.oauthDenied" as const;
  if (kind === "oauth_invalid") return "auth.callbackInvalid" as const;
  if (kind === "blocked") return "auth.accountBlockedBody" as const;
  if (kind === "unauthorized") return "auth.sessionExpired" as const;
  if (kind === "network") return "auth.networkError" as const;
  if (kind === "server") return "auth.serverError" as const;
  return "auth.callbackError" as const;
}

export default function LoginPage() {
  const router = useRouter();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const t = useT();
  const { status, applySession, user } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<AuthNotice | null>(null);
  const [hashReady, setHashReady] = useState(false);

  useEffect(() => {
    const apply = () => {
      const hash = readOAuthHashParams();
      if (hash.accessToken && hash.refreshToken) {
        window.location.replace(`/auth/callback${window.location.hash}${window.location.search}`);
        return;
      }
      const stored = consumeAuthNotice();
      if (hash.error) {
        const oauthKind = classifyOAuthError(hash.error, hash.errorDescription);
        const kind: AuthNoticeKind =
          oauthKind === "oauth_denied" ? "oauth_denied" : oauthKind === "oauth_invalid" ? "oauth_invalid" : "oauth_failed";
        setNotice({ kind, debugDetail: hash.errorDescription ?? hash.error ?? undefined });
        clearOAuthRedirectParams();
        clearRememberedOAuthError();
      } else if (stored) {
        setNotice(stored);
      } else {
        const fromRedirect = readOAuthRedirectError();
        if (fromRedirect) {
          setNotice({ kind: "oauth_failed", debugDetail: fromRedirect });
          clearOAuthRedirectParams();
        }
      }
      setHashReady(true);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (!hashReady || notice) return;
    if (status === "authenticated" && user) {
      router.replace(destinationForUser(user));
    }
  }, [hashReady, notice, status, router, user]);

  const onGoogle = () => {
    clearRememberedOAuthError();
    setNotice(null);
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
      router.replace(destinationForUser(session.user));
    } catch (err) {
      const kind = classifyApiError(err);
      const msg =
        kind === "blocked"
          ? t("auth.accountBlockedBody")
          : kind === "unauthorized"
            ? t("auth.loginFailed")
            : kind === "network"
              ? t("auth.networkError")
              : kind === "server"
                ? t("auth.serverError")
                : err instanceof ApiError
                  ? err.messages.join(" ")
                  : t("auth.loginFailed");
      setFormError(isDevDebugEnabled() && err instanceof ApiError ? `[${err.statusCode}] ${msg}` : msg);
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hashReady || status === "loading" || (status === "authenticated" && !notice)) {
    return <PageLoading />;
  }

  const oauthDescription = notice
    ? isDevDebugEnabled() && notice.debugDetail
      ? `${t(noticeCopyKey(notice.kind))}\n${notice.debugDetail}`
      : t(noticeCopyKey(notice.kind))
    : null;

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

        {notice || formError ? (
          <Alert
            type="error"
            showIcon
            title={notice ? t("auth.callbackError") : undefined}
            description={oauthDescription ?? formError}
            style={{ marginBottom: 16, whiteSpace: "pre-wrap" }}
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
