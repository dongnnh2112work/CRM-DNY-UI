"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "antd";
import { destinationForUser } from "@/lib/access-gate";
import { isDevDebugEnabled } from "@/lib/dev-debug";
import { writeAuthNotice, type AuthNoticeKind } from "@/lib/http/auth-notice";
import { classifyApiError, classifyOAuthError, isPendingMeError, placeholderPendingUser } from "@/lib/http/error-kind";
import {
  clearOAuthRedirectParams,
  clearRememberedOAuthError,
  consumeOAuthLoginInProgress,
  markOAuthLoginInProgress,
  readOAuthHashParams,
  readOAuthRedirectError,
} from "@/lib/http/oauth-redirect";
import { saveSession } from "@/lib/http/tokens";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { authApi } from "@/modules/auth/api";
import { PageLoading } from "@/components/shared/page-loading";

function noticeCopyKey(kind: AuthNoticeKind) {
  if (kind === "oauth_denied") return "auth.oauthDenied" as const;
  if (kind === "oauth_invalid") return "auth.callbackInvalid" as const;
  if (kind === "blocked") return "auth.accountBlockedBody" as const;
  if (kind === "unauthorized") return "auth.sessionExpired" as const;
  if (kind === "network") return "auth.networkError" as const;
  if (kind === "server") return "auth.serverError" as const;
  return "auth.callbackError" as const;
}

export default function AuthCallbackPage() {
  const t = useT();
  const router = useRouter();
  const { applyProfile } = useSession();
  const [errorKind, setErrorKind] = useState<AuthNoticeKind | null>(null);
  const [debugDetail, setDebugDetail] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const hash = readOAuthHashParams();
    if (hash.error) {
      const oauthKind = classifyOAuthError(hash.error, hash.errorDescription);
      const kind: AuthNoticeKind =
        oauthKind === "oauth_denied" ? "oauth_denied" : oauthKind === "oauth_invalid" ? "oauth_invalid" : "oauth_failed";
      const detail = hash.errorDescription ?? hash.error;
      writeAuthNotice(kind, detail ?? undefined);
      clearOAuthRedirectParams();
      clearRememberedOAuthError();
      setErrorKind(kind);
      setDebugDetail(detail);
      return;
    }

    if (!hash.accessToken || !hash.refreshToken) {
      const remembered = readOAuthRedirectError();
      clearOAuthRedirectParams();
      if (remembered) {
        writeAuthNotice("oauth_failed", remembered);
        setErrorKind("oauth_failed");
        setDebugDetail(remembered);
        return;
      }
      writeAuthNotice("oauth_invalid");
      setErrorKind("oauth_invalid");
      return;
    }

    markOAuthLoginInProgress();
    saveSession({
      accessToken: hash.accessToken,
      refreshToken: hash.refreshToken,
      expiresIn: Number.isFinite(hash.expiresIn) ? hash.expiresIn : 0,
    });
    window.history.replaceState(null, "", window.location.pathname);
    clearRememberedOAuthError();

    void (async () => {
      try {
        const me = await authApi.me();
        consumeOAuthLoginInProgress();
        applyProfile(me);
        router.replace(destinationForUser(me));
      } catch (err) {
        const kind = classifyApiError(err);
        if (kind !== "blocked" && (isPendingMeError(err) || kind === "forbidden" || kind === "unauthorized")) {
          applyProfile(placeholderPendingUser());
          router.replace("/pending-approval");
          return;
        }
        if (kind === "network" || kind === "server" || kind === "unknown") {
          setErrorKind(kind === "network" ? "network" : "server");
          return;
        }
        writeAuthNotice(kind === "blocked" ? "blocked" : "unauthorized");
        router.replace("/login");
      }
    })();
  }, [applyProfile, router]);

  if (errorKind) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ maxWidth: 420, width: "100%" }}>
          <Alert
            type="error"
            showIcon
            title={t("auth.callbackError")}
            description={
              <>
                <div>{t(noticeCopyKey(errorKind))}</div>
                {isDevDebugEnabled() && debugDetail ? (
                  <div style={{ marginTop: 8, fontFamily: "monospace", fontSize: 12 }}>{debugDetail}</div>
                ) : null}
              </>
            }
          />
          <Button type="primary" block style={{ marginTop: 16 }} onClick={() => router.replace("/login")}>
            {t("auth.login")}
          </Button>
        </div>
      </div>
    );
  }

  return <PageLoading />;
}
