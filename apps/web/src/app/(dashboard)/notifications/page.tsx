"use client";

import { Button, List, Space, Typography, theme } from "antd";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { ds } from "@/lib/design-tokens";
import { useNotifications } from "@/lib/notifications-store";
import { useT } from "@/lib/use-t";
import { useUsers } from "@/lib/users-store";

export default function NotificationsPage() {
  const t = useT();
  const router = useRouter();
  const { token } = theme.useToken();
  const { currentUser } = useUsers();
  const { forUser, markRead, markAllRead } = useNotifications();

  if (!currentUser) {
    return (
      <EmptyState
        description={t("common.notLoggedIn")}
        action={{ label: t("common.login"), href: "/login" }}
      />
    );
  }

  const items = forUser(currentUser.id);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("shell.notifications") }]}>
        <Button onClick={() => markAllRead(currentUser.id)}>{t("shell.markAllRead")}</Button>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <List
          dataSource={items}
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
                      {new Date(item.createdAt).toLocaleString("vi-VN")}
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
