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
import { App, Avatar, Badge, Button, Dropdown, Empty, Input, Layout, Menu, Result, Space, Tooltip, Typography, theme, type MenuProps } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ds } from "@/lib/design-tokens";
import { formatDisplayDateTime } from "@/lib/format-date";
import { getHeaderSearchTarget, listSearchHref } from "@/lib/header-search";
import { useSession } from "@/lib/session/session-provider";
import { useT } from "@/lib/use-t";
import { useNotifications } from "@/lib/notifications-store";
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

const MOBILE_QUERY = "(max-width: 991px)";
const SIDEBAR_STORAGE_KEY = "crm_sidebar_collapsed";

function readIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_QUERY).matches;
}

/** Desktop: open by default, remember the user's choice. Mobile: closed (drawer). */
function readInitialCollapsed(): boolean {
  if (readIsMobile()) return true;
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

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
  const { forUser, unreadCount, markRead, markAllRead } = useNotifications();
  const [collapsed, setCollapsed] = useState<boolean>(readInitialCollapsed);
  const [mobile, setMobile] = useState<boolean>(readIsMobile);
  const [openKeys, setOpenKeys] = useState<string[]>(["users-group"]);
  const isDark = appTheme === "dark";

  const userId = currentUser?.id;
  const pageMatrix = currentUser ? getEffectivePermissions(currentUser) : null;
  const payrollScope = getPayrollScope(currentUser, pageMatrix, apiUser?.permissions);
  const myNotifs = userId ? forUser(userId).slice(0, 8) : [];
  const unread = userId ? unreadCount(userId) : 0;

  const menuItems = useMemo(() => {
    const navItem = (key: string, icon: ReactNode, labelText: string) => ({
      key,
      icon,
      title: labelText,
      label: navLink(key, labelText),
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
    const allowed = (rows: MenuItems): MenuItems =>
      rows.filter((i) => {
        if (!i) return false;
        if (!("key" in i) || typeof i.key !== "string") return true;
        const page = pageByPath[i.key];
        if (!page) return true;
        return canSeeMenuPage({ page, apiUser, matrix: pageMatrix });
      });

    const payrollItem: MenuItems =
      payrollScope === "none"
        ? []
        : [navItem("/payroll", <CalculatorOutlined />, payrollScope === "self" ? t("payroll.myPay") : t("nav.payroll"))];

    const usersVisible = can(PERMISSION.userManage) && canSeeMenuPage({ page: "users", apiUser, matrix: pageMatrix });
    const userChildren: MenuItems = [
      ...(usersVisible
        ? [
            navItem("/users", <UserOutlined />, t("nav.userList")),
            navItem("/users/pending", <ClockCircleOutlined />, t("nav.pendingUsers")),
          ]
        : []),
      ...(can(PERMISSION.roleManage) || can(PERMISSION.permissionManage)
        ? [navItem("/users/permissions", <SafetyOutlined />, t("nav.permissions"))]
        : []),
    ];

    const sections: Array<{ key: string; titleKey: Parameters<typeof t>[0] | null; rows: MenuItems }> = [
      {
        key: "main",
        titleKey: null,
        rows: [navItem("/dashboard", <DashboardOutlined />, t("nav.dashboard"))],
      },
      {
        key: "work",
        titleKey: "nav.group.work" as const,
        rows: [
          navItem("/customers", <TeamOutlined />, t("nav.customers")),
          navItem("/orders", <ProjectOutlined />, t("nav.orders")),
          navItem("/services", <AppstoreOutlined />, t("nav.services")),
        ],
      },
      {
        key: "finance",
        titleKey: "nav.group.finance" as const,
        rows: [
          navItem("/payments", <DollarOutlined />, t("nav.payments")),
          navItem("/expense-approvals", <AccountBookOutlined />, t("nav.expenses")),
          ...payrollItem,
          navItem("/vat", <FileTextOutlined />, t("nav.vat")),
        ],
      },
      {
        key: "tools",
        titleKey: "nav.group.tools" as const,
        rows: [
          navItem("/emails", <MailOutlined />, t("nav.emails")),
          navItem("/huong-dan", <QuestionCircleOutlined />, t("nav.guide")),
        ],
      },
      {
        key: "admin",
        titleKey: "nav.group.admin" as const,
        rows: [
          ...(userChildren.length
            ? [
                {
                  key: "users-group",
                  icon: <UserOutlined />,
                  title: t("nav.users"),
                  label: t("nav.users"),
                  children: userChildren,
                },
              ]
            : []),
          navItem("/config", <SettingOutlined />, t("nav.config")),
        ],
      },
    ]
      .map((section) => ({ ...section, rows: allowed(section.rows) }))
      .filter((section) => section.rows.length > 0);

    const items: MenuItems = [];
    sections.forEach((section, index) => {
      if (collapsed && !mobile) {
        // Icon-only sidebar: a thin line replaces the group title.
        if (index > 0) items.push({ type: "divider", key: `divider-${section.key}` });
        items.push(...section.rows);
      } else if (section.titleKey) {
        items.push({
          type: "group",
          key: `group-${section.key}`,
          label: t(section.titleKey),
          children: section.rows,
        });
      } else {
        items.push(...section.rows);
      }
    });
    return items;
  }, [t, payrollScope, apiUser, can, pageMatrix, navLink, collapsed, mobile]);

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
    if (mobile) setCollapsed(true);
  }, [pathname, mobile]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const apply = () => {
      setMobile(media.matches);
      // <992px: closed drawer. ≥992px: back to the user's saved choice (open by default).
      setCollapsed(media.matches ? true : readStoredCollapsed());
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const toggleSidebar = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      if (!mobile) {
        try {
          window.localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
        } catch {
          /* storage unavailable — choice just isn't remembered */
        }
      }
      return next;
    });
  }, [mobile]);

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
          aria-label={t("shell.closeMenu")}
          onClick={() => setCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            border: 0,
            padding: 0,
            background: token.colorBgMask,
            zIndex: 150,
          }}
        />
      ) : null}
      <Sider
        className="crm-sider"
        collapsible
        trigger={null}
        collapsed={collapsed}
        collapsedWidth={mobile ? 0 : ds.sidebarCollapsedWidth}
        zeroWidthTriggerStyle={{ display: "none" }}
        onCollapse={setCollapsed}
        width={ds.sidebarWidth}
        theme="light"
        style={{
          background: "var(--crm-sidebar-bg)",
          borderRight: `1px solid ${token.colorBorderSecondary}`,
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
            height: 56,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 10,
            paddingInline: collapsed ? 0 : 16,
            color: token.colorText,
            fontWeight: 700,
            fontSize: ds.fontSize.body,
            letterSpacing: "-0.2px",
            flexShrink: 0,
          }}
        >
          <span className="crm-logo-tile" aria-hidden={!collapsed}>
            DNY
          </span>
          {collapsed ? null : <span>DNY CRM</span>}
        </div>
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[selectedKey]}
          openKeys={collapsed ? undefined : openKeys}
          onOpenChange={setOpenKeys}
          items={menuItems}
          style={{
            background: "transparent",
            borderInlineEnd: "none",
            padding: "4px 12px 16px",
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
            height: 56,
            lineHeight: "56px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flex: "0 0 56px",
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
            background: token.colorBgContainer,
          }}
        >
          <Tooltip title={collapsed ? t("shell.expandMenu") : t("shell.collapseMenu")}>
            <Button
              type="text"
              aria-label={collapsed ? t("shell.expandMenu") : t("shell.collapseMenu")}
              aria-expanded={!collapsed}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
            />
          </Tooltip>
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
            <Tooltip title={t("shell.refreshData")}>
              <Button
                type="text"
                aria-label={t("shell.refreshData")}
                icon={<ReloadOutlined spin={refreshing} />}
                onClick={() => void refreshCurrent()}
              />
            </Tooltip>
            <Tooltip title={t("shell.toggleTheme")}>
              <Button
                type="text"
                aria-label={t("shell.toggleTheme")}
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={() => setTheme(isDark ? "light" : "dark")}
              />
            </Tooltip>
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
                      <div
                        key={item.id}
                        role={item.href ? "link" : undefined}
                        tabIndex={item.href ? 0 : undefined}
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
                        onKeyDown={(event) => {
                          if (!item.href || (event.key !== "Enter" && event.key !== " ")) return;
                          event.preventDefault();
                          markRead(item.id);
                          router.push(item.href);
                        }}
                      >
                        <Typography.Text style={{ fontSize: ds.fontSize.bodySm }}>{item.title}</Typography.Text>
                        <div>
                          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                            {item.body}
                          </Typography.Text>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            >
              <Badge count={unread} size="small" offset={[-2, 2]}>
                <Tooltip title={t("shell.notifications")}>
                  <Button type="text" aria-label={t("shell.openNotifications")} icon={<BellOutlined />} />
                </Tooltip>
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
              <Tooltip title={t("shell.userMenu")}>
                <Button type="text" aria-label={t("shell.userMenu")} style={{ paddingInline: 8, height: 40 }}>
                  <Avatar
                    size="small"
                    src={currentUser?.avatar}
                    icon={<UserOutlined />}
                    style={{
                      background: token.colorFillSecondary,
                      color: token.colorText,
                    }}
                  />
                  <Typography.Text className="crm-user-name" style={{ color: token.colorTextSecondary, fontWeight: 500 }}>
                    {displayName}
                  </Typography.Text>
                </Button>
              </Tooltip>
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
