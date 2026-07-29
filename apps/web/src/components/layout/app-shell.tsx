"use client";

import {
  AppstoreOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  MailOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  ProjectOutlined,
  SettingOutlined,
  SunOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Input, Layout, Menu, Space, Typography, theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { useAppConfig } from "@/components/providers/antd-provider";
import { ds } from "@/lib/design-tokens";

const { Header, Sider, Content } = Layout;

const MENU_ITEMS = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: <Link href="/dashboard">Tổng quan</Link> },
  { type: "divider" as const },
  { key: "/orders", icon: <ProjectOutlined />, label: <Link href="/orders">Quản lý đơn hàng</Link> },
  { key: "/customers", icon: <TeamOutlined />, label: <Link href="/customers">Quản lý khách hàng</Link> },
  { key: "/ctv", icon: <UsergroupAddOutlined />, label: <Link href="/ctv">Quản lý CTV</Link> },
  { type: "divider" as const },
  { key: "/payments", icon: <DollarOutlined />, label: <Link href="/payments">Quản lý thanh toán</Link> },
  { key: "/vat", icon: <FileTextOutlined />, label: <Link href="/vat">Quản lý VAT</Link> },
  { type: "divider" as const },
  { key: "/services", icon: <AppstoreOutlined />, label: <Link href="/services">Danh sách dịch vụ</Link> },
  { key: "/emails", icon: <MailOutlined />, label: <Link href="/emails">Quản lý email</Link> },
  { type: "divider" as const },
  { key: "/users", icon: <UserOutlined />, label: <Link href="/users">Quản lý người dùng</Link> },
  { key: "/config", icon: <SettingOutlined />, label: <Link href="/config">Cấu hình</Link> },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { token } = theme.useToken();
  const { theme: appTheme, setTheme } = useAppConfig();
  const [collapsed, setCollapsed] = useState(false);
  const isDark = appTheme === "dark";

  const selectedKey = useMemo(() => {
    const keys = MENU_ITEMS.filter((i) => "key" in i).map((i) => (i as { key: string }).key);
    return (
      keys
        .filter((k) => pathname === k || pathname.startsWith(k + "/"))
        .sort((a, b) => b.length - a.length)[0] ?? "/dashboard"
    );
  }, [pathname]);

  return (
    <Layout style={{ minHeight: "100vh", background: token.colorBgLayout }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        breakpoint="lg"
        theme="light"
        style={{
          background: isDark ? "#202020" : ds.canvas,
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
            color: isDark ? "#fff" : ds.ink,
            fontWeight: 700,
            fontSize: collapsed ? 14 : 16,
            letterSpacing: "-0.3px",
          }}
        >
          {collapsed ? "DNY" : "DNY CRM"}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={MENU_ITEMS}
          style={{
            background: "transparent",
            borderInlineEnd: "none",
            padding: "4px 8px",
            fontWeight: 500,
            fontSize: 14,
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
            background: isDark ? "#202020" : ds.canvas,
          }}
        >
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ borderRadius: ds.radius.md }}
          />
          <Input.Search placeholder="Tìm kiếm…" allowClear style={{ maxWidth: 360, flex: 1 }} />
          <Space style={{ marginLeft: "auto" }}>
            <Button
              type="text"
              icon={isDark ? <SunOutlined /> : <MoonOutlined />}
              onClick={() => setTheme(isDark ? "light" : "dark")}
              style={{ borderRadius: ds.radius.md }}
            />
            <Avatar
              size="small"
              icon={<UserOutlined />}
              style={{ background: "rgba(0,0,0,0.05)", color: ds.ink }}
            />
            <Typography.Text style={{ color: isDark ? "#fff" : ds.inkSecondary, fontWeight: 500 }}>
              Quản trị
            </Typography.Text>
          </Space>
        </Header>
        <Content style={{ margin: 16 }}>
          <div className="nt-page-shell" style={{ background: token.colorBgContainer, borderColor: token.colorBorder }}>
            {children}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
}
