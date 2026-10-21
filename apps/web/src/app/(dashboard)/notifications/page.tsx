"use client";

import { Button, Empty, Space, Typography, theme } from "antd";
import { useRouter } from "next/navigation";
import { useApiHydrate, useRemoteList } from "@/components/api-hydrator";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { ds } from "@/lib/design-tokens";
import { useNotifications } from "@/lib/notifications-store";
import { formatDisplayDateTime } from "@/lib/format-date";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";

export default function NotificationsPage() {
  const t = useT();
  const router = useRouter();
  const { token } = theme.useToken();
  const { currentUser } = useUsers();
  const { user: apiUser } = useSession();
  const { forUser, markRead, markAllRead } = useNotifications();
  const { ready } = useApiHydrate();
  const notifRemote = useRemoteList("notifications");
  const userId = currentUser?.id ?? apiUser?.id ?? null;

  if (!userId) {
    if (!ready) return <PageLoading />;
    return (
      <EmptyState
        description={t("common.notLoggedIn")}
        action={{ label: t("common.login"), href: "/login" }}
      />
    );
  }

  const items = forUser(userId);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("shell.notifications") }]}>
        <Button onClick={() => markAllRead(userId)}>{t("shell.markAllRead")}</Button>
      </PageHeader>
      <div style={{ padding: 16 }}>
        {notifRemote.bootLoading && items.length === 0 ? (
          <PageLoading />
        ) : items.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("notif.empty")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {items.map((item) => (
              <div
                key={item.id}
                role={item.href ? "link" : undefined}
                tabIndex={item.href ? 0 : undefined}
                style={{
                  background: item.read ? token.colorBgContainer : token.colorPrimaryBg,
                  border: `1px solid ${token.colorBorder}`,
                  borderRadius: token.borderRadiusLG,
                  padding: 16,
                  cursor: item.href ? "pointer" : "default",
                }}
                onClick={() => {
                  markRead(item.id);
                  if (item.href) router.push(item.href);
                }}
                onKeyDown={(event) => {
                  if (!item.href || (event.key !== "Enter" && event.key !== " ")) return;
                  event.preventDefault();
                  markRead(item.id);
                  router.push(item.href);
                }}
              >
                <Space>
                  <Typography.Text strong style={{ fontSize: ds.fontSize.body }}>
                    {item.title}
                  </Typography.Text>
                  {!item.read ? (
                    <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                      {t("notif.new")}
                    </Typography.Text>
                  ) : null}
                </Space>
                <div>{item.body}</div>
                <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                  {formatDisplayDateTime(item.createdAt)}
                </Typography.Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
