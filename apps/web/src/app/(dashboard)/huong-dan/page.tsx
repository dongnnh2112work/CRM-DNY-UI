"use client";

import { theme } from "antd";
import Link from "next/link";
import { GuideShell } from "@/components/guides/guide-shell";
import { PageHeader } from "@/components/shared/page-header";
import { USER_GUIDES } from "@/lib/user-guides";

export default function GuideIndexPage() {
  const { token } = theme.useToken();
  const groups = [...new Set(USER_GUIDES.map((item) => item.group))];

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Hướng dẫn" }]} />
      <GuideShell>
        <h1 style={{ margin: "0 0 8px", fontSize: 24 }}>Hướng dẫn sử dụng</h1>
        <p style={{ marginTop: 0, color: token.colorTextSecondary }}>
          Mỗi chương có số. Trong bài, mục con theo dạng 1.1 và 1.1.1. Ảnh ghi Hình x.y ngay bên dưới.
        </p>
        {groups.map((group) => (
          <section key={group} style={{ marginTop: 16 }}>
            <h2 style={{ fontSize: 14, margin: "0 0 8px", color: token.colorTextSecondary }}>{group}</h2>
            {USER_GUIDES.map((item, index) => ({ item, no: index + 1 }))
              .filter(({ item }) => item.group === group)
              .map(({ item, no }) => (
                <Link
                  key={item.slug}
                  href={`/huong-dan/${item.slug}`}
                  style={{ display: "block", padding: "6px 0", fontWeight: 600 }}
                >
                  <span style={{ color: token.colorPrimary }}>{no}.</span> {item.title}
                </Link>
              ))}
          </section>
        ))}
      </GuideShell>
    </>
  );
}
