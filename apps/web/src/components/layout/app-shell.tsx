"use client";

import {
  AccountBookOutlined,
  AppstoreOutlined,
  BellOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  ProjectOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAppConfig } from "@/components/providers/antd-provider";
import { App, Avatar, Badge, Button, Dropdown, Input, Layout, List, Menu, Space, Typography, theme } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ds } from "@/lib/design-tokens";
import { getHeaderSearchTarget, listSearchHref } from "@/lib/header-search";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useEmails } from "@/lib/emails-store";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { useUsers } from "@/lib/users-store";
import type { AppNotification } from "@/lib/types";

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: <Link href="/dashboard">Tổng quan</Link> },
  { type: "divider" as const },
  { key: "/orders", icon: <ProjectOutlined />, label: <Link href="/orders">Quản lý đơn hàng</Link> },
  { key: "/customers", icon: <TeamOutlined />, label: <Link href="/customers">Quản lý khách hàng</Link> },
  { type: "divider" as const },
  { key: "/payments", icon: <DollarOutlined />, label: <Link href="/payments">Quản lý thanh toán</Link> },
  {
    key: "/expense-approvals",
    icon: <AccountBookOutlined />,
    label: <Link href="/expense-approvals">Duyệt chi</Link>,
  },
  { key: "/vat", icon: <FileTextOutlined />, label: <Link href="/vat">Quản lý VAT</Link> },
  { type: "divider" as const },
  { key: "/services", icon: <AppstoreOutlined />, label: <Link href="/services">Quản lý dịch vụ</Link> },
  { key: "/emails", icon: <MailOutlined />, label: <Link href="/emails">Quản lý email</Link> },
  { type: "divider" as const },
  { key: "/users", icon: <UserOutlined />, label: <Link href="/users">Quản lý người dùng</Link> },
  { key: "/config", icon: <SettingOutlined />, label: <Link href="/config">Cấu hình</Link> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { theme: appTheme, setTheme } = useAppConfig();
  const { currentUser, logout, getById: getUser } = useUsers();
  const { orders, ready: ordersReady } = useOrders();
  const { config } = useAppReminderConfig();
  const { forUser, unreadCount, markRead, markAllRead, scanOrderAlerts, ready: notifReady } =
    useNotifications();
  const { addEmail } = useEmails();
  const [collapsed, setCollapsed] = useState(false);
  const scannedRef = useRef(false);
  const isDark = appTheme === "dark";

  const userId = currentUser?.id;
  const myNotifs = userId ? forUser(userId).slice(0, 8) : [];
  const unread = userId ? unreadCount(userId) : 0;

  useEffect(() => {
    if (!ordersReady || !notifReady || scannedRef.current) return;
    scannedRef.current = true;
    scanOrderAlerts(orders, {
      licenseWarnMonths: config.licenseExpiryWarnMonths,
      vatWarnDays: config.vatIssueWarnDays,
      mirrorEmail: (n: AppNotification) => {
        const user = getUser(n.userId);
        if (!user?.email) return;
        addEmail({
          subject: n.title,
          recipients: [user.email],
          recipientCount: 1,
          status: "sent",
          sentAt: new Date().toISOString().slice(0, 10),
          body: `<p>${n.body}</p><p><a href="${n.href ?? "#"}">Xem chi tiết</a></p>`,
        });
      },
    });
  }, [
    ordersReady,
    notifReady,
    orders,
    config.licenseExpiryWarnMonths,
    config.vatIssueWarnDays,
    scanOrderAlerts,
    addEmail,
    getUser,
  ]);

  const selectedKey = useMemo(() => {
    const keys = MENU_ITEMS.filter((i) => "key" in i).map((i) => (i as { key: string }).key);
    return (
      keys
        .filter((k) => pathname === k || pathname.startsWith(k + "/"))
        .sort((a, b) => b.length - a.length)[0] ?? "/dashboard"
    );
  }, [pathname]);

  const searchTarget = useMemo(() => getHeaderSearchTarget(pathname), [pathname]);

  const onSearch = (value: string) => {
    const q = value.trim();
    if (!q) return;
    if (!searchTarget.listPath) {
      message.info("Trang này không có danh sách để tìm.");
      return;
    }
    router.push(listSearchHref(searchTarget.listPath, q));
  };

  const displayName = currentUser?.name ?? "Khách";

  return (
    <Layout style={{ minHeight: "100vh", background: token.colorBgLayout }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        breakpoint="lg"
        theme={isDark ? "dark" : "light"}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
        }}
      >
        <div
          style={{
            height: 48,
            margin: "0 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            paddingInline: collapsed ? 0 : 12,
            color: token.colorText,
            fontWeight: 700,
            fontSize: collapsed ? ds.fontSize.bodySm : ds.fontSize.body,
            letterSpacing: "-0.3px",
          }}
        >
          {collapsed ? "DNY" : "DNY CRM"}
        </div>
        <Menu
          mode="inline"
          theme={isDark ? "dark" : "light"}
          selectedKeys={[selectedKey]}
          items={MENU_ITEMS}
          style={{
            background: "transparent",
            borderInlineEnd: "none",
            padding: "4px 8px",
            fontWeight: 500,
            fontSize: ds.fontSize.bodySm,
          }}
        />
      </Sider>
      <Layout style={{ background: token.colorBgLayout }}>
        <Header
          style={{
            padding: "0 20px",
            height: 48,
            lineHeight: "48px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: `1px solid ${token.colorBorder}`,
            background: token.colorBgContainer,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ borderRadius: token.borderRadius }}
          />
          <Input.Search
            placeholder={searchTarget.placeholder}
            allowClear
            style={{ maxWidth: 360, flex: 1 }}
            onSearch={onSearch}
          />
          <Space style={{ marginLeft: "auto" }} size={8}>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{ borderRadius: token.borderRadius }}
            />
            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              popupRender={() => (
                <div
                  style={{
                    width: 360,
                    maxHeight: 420,
                    overflow: "auto",
                    background: token.colorBgElevated,
                    borderRadius: token.borderRadiusLG,
                    boxShadow: token.boxShadowSecondary,
                    padding: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "4px 8px 8px",
                    }}
                  >
                    <Typography.Text strong>Thông báo</Typography.Text>
                    <Space size={4}>
                      {userId ? (
                        <Button type="link" size="small" onClick={() => markAllRead(userId)}>
                          Đọc tất cả
                        </Button>
                      ) : null}
                      <Button type="link" size="small" onClick={() => router.push("/notifications")}>
                        Xem tất cả
                      </Button>
                    </Space>
                  </div>
                  <List
                    size="small"
                    dataSource={myNotifs}
                    locale={{ emptyText: "Chưa có thông báo" }}
                    renderItem={(item) => (
                      <List.Item
                        style={{
                          cursor: "pointer",
                          background: item.read ? undefined : token.colorPrimaryBg,
                          padding: "8px 10px",
                          borderRadius: 6,
                        }}
                        onClick={() => {
                          markRead(item.id);
                          if (item.href) router.push(item.href);
                        }}
                      >
                        <List.Item.Meta
                          title={
                            <Typography.Text style={{ fontSize: ds.fontSize.bodySm }}>
                              {item.title}
                            </Typography.Text>
                          }
                          description={
                            <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                              {item.body}
                            </Typography.Text>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </div>
              )}
            >
              <Badge count={unread} size="small" offset={[-2, 2]}>
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  style={{ borderRadius: token.borderRadius }}
                />
              </Badge>
            </Dropdown>
            <Dropdown
              menu={{
                items: [
                  {
                    key: "profile",
                    icon: <UserOutlined />,
                    label: "Cập nhật thông tin",
                    onClick: () => router.push("/profile"),
                    disabled: !currentUser,
                  },
                  { type: "divider" },
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: "Đăng xuất",
                    danger: true,
                    onClick: () => {
                      logout();
                      message.success("Đã đăng xuất");
                      router.push("/login");
                    },
                  },
                ],
              }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Space style={{ cursor: "pointer", paddingInline: 4 }} size={8}>
                <Avatar
                  size="small"
                  src={currentUser?.avatar}
                  icon={<UserOutlined />}
                  style={{
                    background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)",
                    color: token.colorText,
                  }}
                />
                <Typography.Text style={{ color: token.colorTextSecondary, fontWeight: 500 }}>
                  {displayName}
                </Typography.Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <div className="nt-page-shell">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
