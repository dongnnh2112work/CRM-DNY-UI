"use client";

import { Button, List, Space, Typography, theme } from "antd";
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
        <List
          dataSource={items}
          loading={notifRemote.bootLoading && items.length === 0}
          locale={{ emptyText: t("notif.empty") }}
          renderItem={(item) => (
            <List.Item
              style={{
                background: item.read ? token.colorBgContainer : token.colorPrimaryBg,
                border: `1px solid ${token.colorBorder}`,
                borderRadius: token.borderRadiusLG,
                marginBottom: 8,
                padding: 16,
                cursor: item.href ? "pointer" : "default",
              }}
              onClick={() => {
                markRead(item.id);
                if (item.href) router.push(item.href);
              }}
            >
              <List.Item.Meta
                title={
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
                }
                description={
                  <>
                    <div>{item.body}</div>
                    <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                      {formatDisplayDateTime(item.createdAt)}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      </div>
    </>
  );
}
