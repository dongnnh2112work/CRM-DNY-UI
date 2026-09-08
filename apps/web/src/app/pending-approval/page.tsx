"use client";

import { Button, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { accessGate } from "@/lib/access-gate";
import { ds } from "@/lib/design-tokens";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";

export default function PendingApprovalPage() {
  const t = useT();
  const router = useRouter();
  const { status, user, logout } = useSession();
  const gate = accessGate(user);

  useEffect(() => {
    if (status === "anonymous") router.replace("/login");
    if (status === "authenticated" && gate === "ok") router.replace("/dashboard");
  }, [status, gate, router]);

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
          {gate === "blocked" ? t("auth.accountBlocked") : t("auth.waitingApprovalTitle")}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: ds.fontSize.body }}>
          {gate === "blocked" ? t("auth.accountBlockedBody") : t("auth.waitingApprovalBody")}
        </Typography.Paragraph>
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
  );
}
