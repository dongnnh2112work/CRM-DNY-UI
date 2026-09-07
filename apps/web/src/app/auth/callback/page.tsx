"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Typography } from "antd";
import { saveSession } from "@/lib/http/tokens";
import { clearOAuthRedirectParams, readOAuthRedirectError } from "@/lib/http/oauth-redirect";
import { useT } from "@/lib/use-t";

export default function AuthCallbackPage() {
  const t = useT();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const redirectError = readOAuthRedirectError();
    if (redirectError) {
      setError(redirectError);
      clearOAuthRedirectParams();
      return;
    }
    const p = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = p.get("access_token");
    const refreshToken = p.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    saveSession({
      accessToken,
      refreshToken,
      expiresIn: Number(p.get("expires_in") ?? 0),
    });
    window.history.replaceState(null, "", window.location.pathname);
    router.replace("/dashboard");
  }, [router, t]);

  if (error) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <Alert type="error" showIcon title={t("auth.callbackError")} description={error} />
          <Button type="primary" block style={{ marginTop: 16 }} onClick={() => router.replace("/login")}>
            {t("auth.login")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography.Text type="secondary">{t("auth.completingLogin")}</Typography.Text>
    </div>
  );
}
