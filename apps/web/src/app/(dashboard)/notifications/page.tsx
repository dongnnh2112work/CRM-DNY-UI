"use client";

import { Button, Empty } from "antd";
import { useRouter } from "next/navigation";
import { useApiHydrate, useRemoteList } from "@/components/api-hydrator";
import { NotificationRow } from "@/components/notifications/notification-row";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { useNotifications } from "@/lib/notifications-store";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";

export default function NotificationsPage() {
  const t = useT();
  const router = useRouter();
  const { currentUser } = useUsers();
  const { user: apiUser } = useSession();
  const { forUser, markRead, markAllRead, counts, unreadCount } = useNotifications();
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
  const inboxUnread = counts.status === "ready" ? counts.total : unreadCount(userId);
  const openNotification = (item: (typeof items)[number]) => {
    markRead(item.id);
    if (item.href) router.push(item.href);
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("shell.notifications") }]}>
        <UnreadBadge count={inboxUnread} title={t("notif.unreadCount", { n: inboxUnread })} />
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
              <NotificationRow key={item.id} item={item} onOpen={openNotification} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
