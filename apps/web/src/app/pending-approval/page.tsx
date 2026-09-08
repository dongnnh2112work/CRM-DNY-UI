"use client";

import { Button, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { accessGate, userStatus } from "@/lib/access-gate";
import { ds } from "@/lib/design-tokens";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";

export default function PendingApprovalPage() {
  const t = useT();
  const router = useRouter();
  const { status, user, logout, refreshMe } = useSession();
  const gate = accessGate(user);
  const invited = userStatus(user) === "INVITED";

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && gate === "ok") router.replace("/dashboard");
  }, [status, gate, router]);

  useEffect(() => {
    if (status !== "authenticated" || gate !== "pending") return;
    const id = window.setInterval(() => {
      void refreshMe();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [status, gate, refreshMe]);

  if (status !== "authenticated") return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <Typography.Title level={4} style={{ marginBottom: 8 }}>
          {gate === "blocked"
            ? t("auth.accountBlocked")
            : invited
              ? t("auth.invitedTitle")
              : t("auth.waitingApprovalTitle")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.body }}>
          {gate === "blocked"
            ? t("auth.accountBlockedBody")
            : invited
              ? t("auth.invitedBody")
              : t("auth.waitingApprovalBody")}
        </Typography.Paragraph>
        {user?.email ? (
          <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
            {user.email}
          </Typography.Paragraph>
        ) : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          {gate === "pending" ? (
            <Button onClick={() => void refreshMe()}>{t("auth.checkAgain")}</Button>
          ) : null}
          <Button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
          >
            {t("shell.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
