"use client";

import { theme } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { USER_GUIDES } from "@/lib/user-guides";

export function GuideShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token } = theme.useToken();
  const groups = [...new Set(USER_GUIDES.map((item) => item.group))];

  return (
    <div className="guide-shell">
      <aside className="guide-toc" style={{ borderRight: `1px solid ${token.colorBorder}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: token.colorTextSecondary, paddingLeft: 8 }}>Mục lục</div>
        {groups.map((group) => (
          <div key={group} style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, padding: "0 8px 4px" }}>{group}</div>
            {USER_GUIDES.map((item, index) => ({ item, no: index + 1 }))
              .filter(({ item }) => item.group === group)
              .map(({ item, no }) => {
                const href = `/huong-dan/${item.slug}`;
                const active = pathname === href;
                return (
                  <Link
                    key={item.slug}
                    href={href}
                    style={{
                      display: "block",
                      padding: "6px 8px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: active ? 700 : 500,
                      background: active ? "rgba(0,117,222,0.08)" : "transparent",
                      color: token.colorText,
                    }}
                  >
                    <span style={{ color: token.colorPrimary, fontWeight: 700, marginRight: 6 }}>{no}.</span>
                    {item.title}
                  </Link>
                );
              })}
          </div>
        ))}
      </aside>
      <div className="guide-body">{children}</div>
    </div>
  );
}
