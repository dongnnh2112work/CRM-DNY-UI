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
  QuestionCircleOutlined,
  ReloadOutlined,
  SafetyOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useAppConfig } from "@/components/providers/antd-provider";
import { useApiHydrate } from "@/components/api-hydrator";
import { App, Avatar, Badge, Button, Dropdown, Empty, Input, Layout, Menu, Result, Space, Typography, theme, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NotificationRow } from "@/components/notifications/notification-row";
import { UnreadBadge } from "@/components/notifications/unread-badge";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDateTime } from "@/lib/format-date";
import { getHeaderSearchTarget, listSearchHref } from "@/lib/header-search";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { useNotifications } from "@/lib/notifications-store";
import type { AppNotification } from "@/lib/types";
import { categoriesForPath, MENU_BADGE_CATEGORIES, sumCategoryCounts } from "@/modules/notifications/model";
import { getPayrollScope } from "@/lib/payroll";
import { canSeeMenuPage, PERMISSION } from "@/lib/rbac";
import { useUsers } from "@/lib/users-store";

const { Header, Sider, Content } = Layout;

type MenuItems = NonNullable<MenuProps["items"]>;

const ROUTE_PAGE: Array<{ prefix: string; page: Parameters<typeof canSeeMenuPage>[0]["page"] }> = [
  { prefix: "/users", page: "users" },
  { prefix: "/orders", page: "orders" },
  { prefix: "/customers", page: "customers" },
  { prefix: "/payments", page: "payments" },
  { prefix: "/expense-approvals", page: "expense_approvals" },
  { prefix: "/payroll", page: "payroll" },
  { prefix: "/vat", page: "vat" },
  { prefix: "/services", page: "services" },
  { prefix: "/emails", page: "emails" },
  { prefix: "/config", page: "config" },
  { prefix: "/dashboard", page: "dashboard" },
];

function pageForPath(pathname: string): Parameters<typeof canSeeMenuPage>[0]["page"] | null {
  const hit = ROUTE_PAGE.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  return hit?.page ?? null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { theme: appTheme, setTheme } = useAppConfig();
  const t = useT();
  const { currentUser, logout, getEffectivePermissions } = useUsers();
  const { user: apiUser, can, logout: logoutApi } = useSession();
  const { refreshing, lastSyncedAt, refreshCurrent, prefetchPath } = useApiHydrate();

  const navLink = useCallback(
    (href: string, label: ReactNode) => (
      <Link
        href={href}
        onMouseEnter={() => {
          router.prefetch(href);
          prefetchPath(href);
        }}
        onFocus={() => {
          router.prefetch(href);
          prefetchPath(href);
        }}
      >
        {label}
      </Link>
    ),
    [router, prefetchPath],
  );
  const { forUser, unreadCount, markRead, markAllRead, counts, markCategoriesRead } = useNotifications();
  const [collapsed, setCollapsed] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>(["users-group"]);
  const navSyncKey = `${pathname}:${mobile ? "m" : "d"}`;
  const [seenNavSync, setSeenNavSync] = useState(navSyncKey);
  if (seenNavSync !== navSyncKey) {
    setSeenNavSync(navSyncKey);
    if (pathname.startsWith("/users")) {
      setOpenKeys((prev) => (prev.includes("users-group") ? prev : [...prev, "users-group"]));
    }
    if (mobile) setCollapsed(true);
  }
  const isDark = appTheme === "dark";

  const userId = currentUser?.id;
  const pageMatrix = currentUser ? getEffectivePermissions(currentUser) : null;
  const payrollScope = getPayrollScope(currentUser, pageMatrix, apiUser?.permissions);
  const mine = userId ? forUser(userId) : [];
  const myNotifs = mine.slice(0, 8);
  const localUnread = userId ? unreadCount(userId) : 0;
  const bellCount = counts.status === "ready" ? counts.total : localUnread;
  const unreadSignature = mine
    .filter((n) => !n.read)
    .map((n) => `${n.category ?? "-"}:${n.id}`)
    .join("|");
  const markedKeyRef = useRef("");

  useEffect(() => {
    const categories = categoriesForPath(pathname);
    if (!categories.length || counts.status === "idle") return;
    const visitKey = `${userId ?? ""}:${pathname}`;
    if (markedKeyRef.current === visitKey) return;
    const localPending = unreadSignature
      .split("|")
      .some((part) => categories.some((category) => part.startsWith(`${category}:`)));
    const pending =
      (counts.status === "ready" && sumCategoryCounts(counts.byCategory, categories) > 0) || localPending;
    markedKeyRef.current = visitKey;
    if (pending) markCategoriesRead(categories);
  }, [pathname, counts, unreadSignature, markCategoriesRead, userId]);

  const openNotification = (item: AppNotification) => {
    markRead(item.id);
    if (item.href) router.push(item.href);
  };

  const menuItems = useMemo(() => {
    const badgeFor = (key: string) => {
      if (counts.status !== "ready") return 0;
      const categories = MENU_BADGE_CATEGORIES[key];
      return categories ? sumCategoryCounts(counts.byCategory, categories) : 0;
    };
    const labelWithCount = (text: string, count: number) => (
      <span className="crm-nav-label">
        <span className="crm-nav-label-text">{text}</span>
        {collapsed ? null : <UnreadBadge count={count} title={t("notif.unreadCount", { n: count })} />}
      </span>
    );
    const iconWithCount = (icon: ReactNode, count: number) =>
      collapsed && count > 0 ? (
        <Badge
          count={count}
          overflowCount={99}
          size="small"
          color={ds.danger}
          offset={[6, -6]}
          title={t("notif.unreadCount", { n: count })}
        >
          {icon}
        </Badge>
      ) : (
        icon
      );
    const ordersCount = badgeFor("/orders");
    const paymentsCount = badgeFor("/payments");
    const expensesCount = badgeFor("/expense-approvals");
    const vatCount = badgeFor("/vat");
    const emailsCount = badgeFor("/emails");
    const usersCount = badgeFor("users-group");
    const payrollItem: MenuItems =
      payrollScope === "none"
        ? []
        : [
            {
              key: "/payroll",
              icon: <CalculatorOutlined />,
              label: navLink("/payroll", payrollScope === "self" ? t("payroll.myPay") : t("nav.payroll")),
            },
          ];
    const items: MenuItems = [
      { key: "/dashboard", icon: <DashboardOutlined />, label: navLink("/dashboard", t("nav.dashboard")) },
      { type: "divider" },
      { key: "/customers", icon: <TeamOutlined />, label: navLink("/customers", t("nav.customers")) },
      {
        key: "/orders",
        icon: iconWithCount(<ProjectOutlined />, ordersCount),
        label: navLink("/orders", labelWithCount(t("nav.orders"), ordersCount)),
      },
      { type: "divider" },
      {
        key: "/payments",
        icon: iconWithCount(<DollarOutlined />, paymentsCount),
        label: navLink("/payments", labelWithCount(t("nav.payments"), paymentsCount)),
      },
      {
        key: "/expense-approvals",
        icon: iconWithCount(<AccountBookOutlined />, expensesCount),
        label: navLink("/expense-approvals", labelWithCount(t("nav.expenses"), expensesCount)),
      },
      ...payrollItem,
      {
        key: "/vat",
        icon: iconWithCount(<FileTextOutlined />, vatCount),
        label: navLink("/vat", labelWithCount(t("nav.vat"), vatCount)),
      },
      { type: "divider" },
      { key: "/services", icon: <AppstoreOutlined />, label: navLink("/services", t("nav.services")) },
      {
        key: "/emails",
        icon: iconWithCount(<MailOutlined />, emailsCount),
        label: navLink("/emails", labelWithCount(t("nav.emails"), emailsCount)),
      },
      { type: "divider" },
    ];
    const usersVisible = can(PERMISSION.userManage) && canSeeMenuPage({ page: "users", apiUser, matrix: pageMatrix });
    const userChildren: MenuItems = [
      ...(usersVisible
        ? [
            { key: "/users", icon: <UserOutlined />, label: navLink("/users", t("nav.userList")) },
            {
              key: "/users/pending",
              icon: <ClockCircleOutlined />,
              label: navLink("/users/pending", t("nav.pendingUsers")),
            },
          ]
        : []),
      ...(can(PERMISSION.roleManage) || can(PERMISSION.permissionManage)
        ? [
            {
              key: "/users/permissions",
              icon: <SafetyOutlined />,
              label: navLink("/users/permissions", t("nav.permissions")),
            },
          ]
        : []),
    ];
    if (userChildren.length) {
      items.push({
        key: "users-group",
        icon: iconWithCount(<UserOutlined />, usersCount),
        label: labelWithCount(t("nav.users"), usersCount),
        children: userChildren,
      });
    }
    items.push({ key: "/config", icon: <SettingOutlined />, label: navLink("/config", t("nav.config")) });
    items.push({
      key: "/huong-dan",
      icon: <QuestionCircleOutlined />,
      label: navLink("/huong-dan", t("nav.guide")),
    });
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
  }, [t, payrollScope, apiUser, can, pageMatrix, navLink, collapsed, counts]);

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
    const media = window.matchMedia("(max-width: 991px)");
    const apply = () => {
      setMobile(media.matches);
      if (media.matches) setCollapsed(true);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

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

  const routeAllowed = useMemo(() => {
    if (pathname.startsWith("/users/permissions")) {
      return can(PERMISSION.roleManage) || can(PERMISSION.permissionManage);
    }
    const page = pageForPath(pathname);
    if (!page) return true;
    return canSeeMenuPage({ page, apiUser, matrix: pageMatrix });
  }, [pathname, can, apiUser, pageMatrix]);

  return (
    <Layout className="crm-layout" style={{ height: "100dvh", overflow: "hidden", background: token.colorBgLayout }}>
      {mobile && !collapsed ? (
        <button
          type="button"
          aria-label="Đóng menu"
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            border: 0,
            padding: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 150,
          }}
        />
      ) : null}
      <Sider
        className="crm-sider"
        collapsible
        trigger={null}
        collapsed={collapsed}
        collapsedWidth={mobile ? 0 : 80}
        zeroWidthTriggerStyle={{ display: "none" }}
        onCollapse={setCollapsed}
        width={280}
        theme={isDark ? "dark" : "light"}
        style={{
          background: token.colorBgContainer,
          borderRight: `1px solid ${token.colorBorder}`,
          ...(mobile
            ? {
                position: "fixed",
                zIndex: 200,
                height: "100dvh",
                left: 0,
                top: 0,
              }
            : null),
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
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          style={{
            background: "transparent",
            borderInlineEnd: "none",
            padding: "4px 8px",
            fontWeight: 500,
            fontSize: ds.fontSize.bodySm,
          }}
        />
      </Sider>
      <Layout className="crm-main" style={{ minWidth: 0, minHeight: 0, height: "100%", overflow: "hidden", background: token.colorBgLayout }}>
        <Header
          className="crm-header"
          style={{
            padding: "0 20px",
            height: 48,
            lineHeight: "48px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: "0 0 48px",
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
            id="header-search"
            autoComplete="off"
            placeholder={t(searchTarget.placeholderKey)}
            allowClear
            style={{ maxWidth: 360, flex: 1, minWidth: 0 }}
            onSearch={onSearch}
          />
          <Space style={{ marginLeft: "auto" }} size={8}>
            <Typography.Text className="crm-sync" type="secondary" style={{ fontSize: ds.fontSize.caption, whiteSpace: "nowrap" }}>
              {lastSyncedAt
                ? t("shell.lastSynced", {
                    time: formatDisplayDateTime(lastSyncedAt),
                  })
                : t("shell.lastSyncedNever")}
            </Typography.Text>
            <Button
              type="text"
              icon={<ReloadOutlined spin={refreshing} />}
              onClick={() => void refreshCurrent()}
              title={t("shell.refreshData")}
              style={{ borderRadius: token.borderRadius }}
            />
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
                  {myNotifs.length === 0 ? (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("shell.noNotifications")} />
                  ) : (
                    myNotifs.map((item) => (
                      <NotificationRow key={item.id} item={item} variant="menu" onOpen={openNotification} />
                    ))
                  )}
                </div>
              )}
            >
              <Badge
                count={bellCount}
                overflowCount={99}
                size="small"
                color={ds.danger}
                offset={[-2, 2]}
                title={t("notif.unreadCount", { n: bellCount })}
              >
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
                <Typography.Text className="crm-user-name" style={{ color: token.colorTextSecondary, fontWeight: 500 }}>
                  {displayName}
                </Typography.Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>
        <Content
          className="crm-content"
          style={{ margin: 16, flex: 1, minHeight: 0, minWidth: 0, display: "flex", overflow: "hidden" }}
        >
          <div className="nt-page-shell">
            {routeAllowed ? (
              children
            ) : (
              <Result
                status="403"
                title="403"
                subTitle={t("shell.noPageAccess")}
                extra={
                  <Button type="primary" onClick={() => router.push("/dashboard")}>
                    {t("nav.dashboard")}
                  </Button>
                }
              />
            )}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
