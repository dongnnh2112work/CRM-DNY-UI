"use client";

import { Typography } from "antd";
import Link from "next/link";
import { GuideShell } from "@/components/guides/guide-shell";
import { PageHeader } from "@/components/shared/page-header";
import { USER_GUIDES } from "@/lib/user-guides";

export default function GuideIndexPage() {
  const first = USER_GUIDES.find((item) => item.status === "ready");

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Hướng dẫn" }]} />
      <GuideShell>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Hướng dẫn sử dụng
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Chọn mục bên trái. Mục ghi “Sắp có” chưa có bài.
        </Typography.Paragraph>
        {first ? (
          <Link href={`/huong-dan/${first.slug}`}>Mở bài {first.title}</Link>
        ) : null}
      </GuideShell>
    </>
  );
}
