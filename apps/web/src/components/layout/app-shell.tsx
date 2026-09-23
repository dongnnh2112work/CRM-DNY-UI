"use client";

import {
  AccountBookOutlined,
  AppstoreOutlined,
  CalculatorOutlined,
  BellOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  ProjectOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAppConfig } from "@/components/providers/antd-provider";
import { useApiHydrate } from "@/components/api-hydrator";
import {
  App,
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Input,
  Layout,
  List,
  Menu,
  Space,
  Typography,
  theme,
  type MenuProps,
} from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDateTime } from "@/lib/format-date";
import { getHeaderSearchTarget, listSearchHref } from "@/lib/header-search";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { useEmails } from "@/lib/emails-store";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { getPayrollScope } from "@/lib/payroll";
import { canSeeMenuPage, PERMISSION } from "@/lib/rbac";
import { useServices } from "@/lib/services-store";
import { useUsers } from "@/lib/users-store";

const { Header, Sider, Content } = Layout;
const { useBreakpoint } = Grid;

type MenuItems = NonNullable<MenuProps["items"]>;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { theme: appTheme, setTheme } = useAppConfig();
  const t = useT();
  const { currentUser, logout, getById: getUser, getEffectivePermissions } = useUsers();
  const { user: apiUser, can, logout: logoutApi } = useSession();
  const { refreshing, lastSyncedAt, refreshCurrent } = useApiHydrate();
  const { orders, ready: ordersReady } = useOrders();
  const { services, ready: servicesReady } = useServices();
  const { config } = useAppReminderConfig();
  const { forUser, unreadCount, markRead, markAllRead, scanOrderAlerts, ready: notifReady } =
    useNotifications();
  const { addEmails } = useEmails();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(["users-group"]);
  const scannedRef = useRef(false);
  const isDark = appTheme === "dark";

  const userId = currentUser?.id;
  const pageMatrix = currentUser ? getEffectivePermissions(currentUser) : null;
  const payrollScope = getPayrollScope(currentUser, pageMatrix, apiUser?.permissions);
  const myNotifs = userId ? forUser(userId).slice(0, 8) : [];
  const unread = userId ? unreadCount(userId) : 0;

  useEffect(() => {
    if (!ordersReady || !servicesReady || !notifReady || scannedRef.current) return;
    scannedRef.current = true;
    const created = scanOrderAlerts(orders, {
      services,
      vatWarnDays: config.vatIssueWarnDays,
    });
    const today = new Date().toISOString().slice(0, 10);
    const viewLabel = t("shell.viewDetails");
    addEmails(
      created.flatMap((n) => {
        const user = getUser(n.userId);
        if (!user?.email) return [];
        return [
          {
            subject: n.title,
            recipients: [user.email],
            recipientCount: 1,
            status: "sent" as const,
            sentAt: today,
            body: `<p>${n.body}</p><p><a href="${n.href ?? "#"}">${viewLabel}</a></p>`,
          },
        ];
      }),
    );
  }, [
    ordersReady,
    servicesReady,
    notifReady,
    orders,
    services,
    config.vatIssueWarnDays,
    scanOrderAlerts,
    addEmails,
    getUser,
    t,
  ]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const menuItems = useMemo(() => {
    const payrollItem: MenuItems =
      payrollScope === "none"
        ? []
        : [
            {
              key: "/payroll",
              icon: <CalculatorOutlined />,
              label: (
                <Link href="/payroll">
                  {payrollScope === "self" ? t("payroll.myPay") : t("nav.payroll")}
                </Link>
              ),
            },
          ];
    const items: MenuItems = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: <Link href="/dashboard">{t("nav.dashboard")}</Link> },
      { type: "divider" },
      { key: "/customers", icon: <TeamOutlined />, label: <Link href="/customers">{t("nav.customers")}</Link> },
      { key: "/orders", icon: <ProjectOutlined />, label: <Link href="/orders">{t("nav.orders")}</Link> },
      { type: "divider" },
      { key: "/payments", icon: <DollarOutlined />, label: <Link href="/payments">{t("nav.payments")}</Link> },
      {
        key: "/expense-approvals",
        icon: <AccountBookOutlined />,
        label: <Link href="/expense-approvals">{t("nav.expenses")}</Link>,
      },
      ...payrollItem,
      { key: "/vat", icon: <FileTextOutlined />, label: <Link href="/vat">{t("nav.vat")}</Link> },
      { type: "divider" },
      { key: "/services", icon: <AppstoreOutlined />, label: <Link href="/services">{t("nav.services")}</Link> },
      { key: "/emails", icon: <MailOutlined />, label: <Link href="/emails">{t("nav.emails")}</Link> },
      { type: "divider" },
    ];
    const usersVisible = can(PERMISSION.userManage) && canSeeMenuPage({ page: "users", apiUser, matrix: pageMatrix });
    const userChildren: MenuItems = [
      ...(usersVisible
        ? [
            { key: "/users", icon: <UserOutlined />, label: <Link href="/users">{t("nav.userList")}</Link> },
            {
              key: "/users/pending",
              icon: <ClockCircleOutlined />,
              label: <Link href="/users/pending">{t("nav.pendingUsers")}</Link>,
            },
          ]
        : []),
      ...(can(PERMISSION.roleManage) || can(PERMISSION.permissionManage)
        ? [
            {
              key: "/users/permissions",
              icon: <SafetyOutlined />,
              label: <Link href="/users/permissions">{t("nav.permissions")}</Link>,
            },
          ]
        : []),
    ];
    if (userChildren.length) {
      items.push({
        key: "users-group",
        icon: <UserOutlined />,
        label: t("nav.users"),
        children: userChildren,
      });
    }
    items.push({ key: "/config", icon: <SettingOutlined />, label: <Link href="/config">{t("nav.config")}</Link> });
    const pageByPath: Record<string, Parameters<typeof canSeeMenuPage>[0]["page"]> = {
      "/orders": "orders",
      "/customers": "customers",
      "/payments": "payments",
      "/expense-approvals": "expense_approvals",
      "/payroll": "payroll",
      "/vat": "vat",
      "/services": "services",
      "/emails": "emails",
      "/users": "users",
      "/users/pending": "users",
      "/config": "config",
      "/dashboard": "dashboard",
    };
    return items.filter((i) => {
      if (!i) return false;
      if (!("key" in i) || typeof i.key !== "string") return true;
      const page = pageByPath[i.key];
      if (!page) return true;
      return canSeeMenuPage({ page, apiUser, matrix: pageMatrix });
    });
  }, [t, payrollScope, apiUser, can, pageMatrix]);

  const selectedKey = useMemo(() => {
    const keys: string[] = [];
    const walk = (rows: MenuItems) => {
      for (const item of rows) {
        if (!item) continue;
        if ("key" in item && typeof item.key === "string") keys.push(item.key);
        if ("children" in item && Array.isArray(item.children)) walk(item.children as MenuItems);
      }
    };
    walk(menuItems);
    return (
      keys
        .filter((k) => pathname === k || pathname.startsWith(k + "/"))
        .sort((a, b) => b.length - a.length)[0] ?? "/dashboard"
    );
  }, [pathname, menuItems]);

  useEffect(() => {
    if (pathname.startsWith("/users")) {
      setOpenKeys((prev) => (prev.includes("users-group") ? prev : [...prev, "users-group"]));
    }
  }, [pathname]);

  const searchTarget = useMemo(() => getHeaderSearchTarget(pathname), [pathname]);

  const onSearch = (value: string) => {
    const q = value.trim();
    if (!q) return;
    if (!searchTarget.listPath) {
      message.info(t("shell.searchNone"));
      return;
    }
    router.push(listSearchHref(searchTarget.listPath, q));
  };

  const displayName = apiUser?.displayName ?? currentUser?.name ?? t("shell.guest");

  const brand = (
    <div
      style={{
        height: 48,
        margin: "0 8px",
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed && !isMobile ? "center" : "flex-start",
        paddingInline: collapsed && !isMobile ? 0 : 12,
        color: token.colorText,
        fontWeight: 700,
        fontSize: collapsed && !isMobile ? ds.fontSize.bodySm : ds.fontSize.body,
        letterSpacing: "-0.3px",
      }}
    >
      {collapsed && !isMobile ? "DNY" : "DNY CRM"}
    </div>
  );

  const sideMenu = (
    <Menu
      mode="inline"
      theme={isDark ? "dark" : "light"}
      selectedKeys={[selectedKey]}
      openKeys={collapsed && !isMobile ? undefined : openKeys}
      onOpenChange={setOpenKeys}
      items={menuItems}
      onClick={() => {
        if (isMobile) setMobileNavOpen(false);
      }}
      style={{
        background: "transparent",
        borderInlineEnd: "none",
        padding: "4px 8px",
        fontWeight: 500,
        fontSize: ds.fontSize.bodySm,
      }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh", background: token.colorBgLayout }}>
      <a href="#crm-main" className="crm-skip-link">
        {t("shell.skipToContent")}
      </a>
      {!isMobile ? (
        <Sider
          className="crm-sider"
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          width={280}
          theme={isDark ? "dark" : "light"}
          style={{
            background: token.colorBgContainer,
            borderRight: `1px solid ${token.colorBorder}`,
          }}
        >
          {brand}
          {sideMenu}
        </Sider>
      ) : (
        <Drawer
          open={mobileNavOpen}
          onClose={() => setMobileNavOpen(false)}
          placement="left"
          width={280}
          styles={{ body: { padding: 0 } }}
          title="DNY CRM"
        >
          <div className="crm-sider">{sideMenu}</div>
        </Drawer>
      )}
      <Layout style={{ background: token.colorBgLayout }}>
        <Header
          style={{
            padding: isMobile ? "0 12px" : "0 20px",
            height: 56,
            lineHeight: "56px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${token.colorBorder}`,
            background: token.colorBgContainer,
          }}
        >
          <Button
            type="text"
            className="crm-pressable crm-header-icon"
            icon={
              isMobile ? (
                <MenuUnfoldOutlined />
              ) : collapsed ? (
                <MenuUnfoldOutlined />
              ) : (
                <MenuFoldOutlined />
              )
            }
            aria-label={t("shell.toggleNav")}
            aria-expanded={isMobile ? mobileNavOpen : !collapsed}
            onClick={() => {
              if (isMobile) setMobileNavOpen((open) => !open);
              else setCollapsed(!collapsed);
            }}
            style={{ borderRadius: token.borderRadius }}
          />
          <Input.Search
            placeholder={t(searchTarget.placeholderKey)}
            allowClear
            style={{ maxWidth: isMobile ? "100%" : 360, flex: 1, minWidth: 0 }}
            onSearch={onSearch}
            aria-label={t(searchTarget.placeholderKey)}
          />
          <Space style={{ marginLeft: "auto", flexShrink: 0 }} size={4}>
            {!isMobile ? (
              <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption, whiteSpace: "nowrap" }}>
                {lastSyncedAt
                  ? t("shell.lastSynced", {
                      time: formatDisplayDateTime(lastSyncedAt),
                    })
                  : t("shell.lastSyncedNever")}
              </Typography.Text>
            ) : null}
            <Button
              type="text"
              className="crm-pressable crm-header-icon"
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => void refreshCurrent()}
              title={t("shell.refreshData")}
              aria-label={t("shell.refreshData")}
              style={{ borderRadius: token.borderRadius }}
            />
            <Button
              type="text"
              className="crm-pressable crm-header-icon"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              aria-label={t("shell.toggleTheme")}
              style={{ borderRadius: token.borderRadius }}
            />
            <Dropdown
              trigger={["click"]}
              placement="bottomRight"
              popupRender={() => (
                <div
                  style={{
                    width: 360,
                    maxWidth: "calc(100vw - 24px)",
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
                    <Typography.Text strong>{t("shell.notifications")}</Typography.Text>
                    <Space size={4}>
                      {userId ? (
                        <Button type="link" size="small" onClick={() => markAllRead(userId)}>
                          {t("shell.markAllRead")}
                        </Button>
                      ) : null}
                      <Button type="link" size="small" onClick={() => router.push("/notifications")}>
                        {t("shell.viewAll")}
                      </Button>
                    </Space>
                  </div>
                  <List
                    size="small"
                    dataSource={myNotifs}
                    locale={{ emptyText: t("shell.noNotifications") }}
                    renderItem={(item) => (
                      <List.Item
                        role="button"
                        tabIndex={0}
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
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            markRead(item.id);
                            if (item.href) router.push(item.href);
                          }
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
                  className="crm-pressable crm-header-icon"
                  icon={<BellOutlined />}
                  aria-label={t("shell.openNotifications")}
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
                    label: t("shell.profile"),
                    onClick: () => router.push("/profile"),
                    disabled: !currentUser,
                  },
                  { type: "divider" },
                  {
                    key: "logout",
                    icon: <LogoutOutlined />,
                    label: t("shell.logout"),
                    danger: true,
                    onClick: async () => {
                      await logoutApi();
                      logout();
                      message.success(t("shell.loggedOut"));
                      router.push("/login");
                    },
                  },
                ],
              }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <Button
                type="text"
                className="crm-pressable"
                aria-label={t("shell.userMenu")}
                style={{
                  height: 40,
                  paddingInline: isMobile ? 4 : 8,
                  borderRadius: token.borderRadius,
                }}
              >
                <Space size={8}>
                  <Avatar
                    size="small"
                    src={currentUser?.avatar}
                    icon={<UserOutlined />}
                    style={{
                      background: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)",
                      color: token.colorText,
                    }}
                  />
                  {!isMobile ? (
                    <Typography.Text style={{ color: token.colorTextSecondary, fontWeight: 500 }}>
                      {displayName}
                    </Typography.Text>
                  ) : null}
                </Space>
              </Button>
            </Dropdown>
          </Space>
        </Header>
        <Content id="crm-main" tabIndex={-1} style={{ margin: isMobile ? 8 : 16, outline: "none" }}>
          <div className="nt-page-shell">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
