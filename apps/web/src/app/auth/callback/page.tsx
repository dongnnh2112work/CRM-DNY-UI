"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PageLoading } from "@/components/shared/page-loading";
import { Alert, Button, Typography } from "antd";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";

function parseOAuthHash(hash: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return {
    error: params.get("error"),
    errorDescription: params.get("error_description"),
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
  };
}

export default function AuthCallbackPage() {
  const t = useT();
  const router = useRouter();
  const { applyTokens, status } = useSession();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const parsed = parseOAuthHash(window.location.hash);
    window.history.replaceState(null, "", window.location.pathname);

    if (parsed.error) {
      setError(parsed.errorDescription || parsed.error);
      return;
    }
    if (!parsed.accessToken || !parsed.refreshToken) {
      setError(t("auth.callbackInvalid"));
      return;
    }

    void applyTokens(parsed.accessToken, parsed.refreshToken)
      .then(() => router.replace("/dashboard"))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : t("auth.callbackError"));
      });
  }, [applyTokens, router, t]);

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

  if (status === "authenticated") {
    return <PageLoading />;
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Typography.Text type="secondary">{t("auth.completingLogin")}</Typography.Text>
    </div>
  );
}
