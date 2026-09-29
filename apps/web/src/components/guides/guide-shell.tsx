"use client";

import { Typography, theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { USER_GUIDES } from "@/lib/user-guides";

export function GuideShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token } = theme.useToken();
  const groups = [...new Set(USER_GUIDES.map((item) => item.group))];

  return (
    <div style={{ display: "flex", minHeight: 480, alignItems: "stretch" }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: `1px solid ${token.colorBorder}`,
          padding: "16px 12px",
        }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 12, paddingLeft: 8 }}>
          Mục lục
        </Typography.Text>
        {groups.map((group) => (
          <div key={group} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, padding: "0 8px 4px" }}>{group}</div>
            {USER_GUIDES.filter((item) => item.group === group).map((item) => {
              const href = `/huong-dan/${item.slug}`;
              const active = pathname === href;
              if (item.status !== "ready") {
                return (
                  <div key={item.slug} style={{ padding: "6px 8px", color: token.colorTextTertiary, fontSize: 14 }}>
                    {item.title}
                    <span style={{ marginLeft: 6, fontSize: 11 }}>Sắp có</span>
                  </div>
                );
              }
              return (
                <Link
                  key={item.slug}
                  href={href}
                  style={{
                    display: "block",
                    padding: "6px 8px",
                    borderRadius: 8,
                    fontSize: 14,
                    fontWeight: active ? 600 : 500,
                    background: active ? "rgba(0,117,222,0.08)" : "transparent",
                    color: token.colorText,
                  }}
                >
                  {item.title}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
      <div style={{ flex: 1, padding: 24, minWidth: 0 }}>{children}</div>
    </div>
  );
}
