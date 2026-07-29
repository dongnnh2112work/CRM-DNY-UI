"use client";

import { Button, Table, Tag, type TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_EMAILS } from "@/lib/mock-emails";
import type { EmailRecord, EmailStatus } from "@/lib/types";

const EMAIL_STATUS_LABELS: Record<EmailStatus, string> = {
  draft: "Nháp",
  sent: "Đã gửi",
  scheduled: "Đã lên lịch",
  failed: "Thất bại",
};

const statusColor: Record<EmailStatus, string> = { draft: "default", sent: "success", scheduled: "processing", failed: "error" };

export default function EmailsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const filtered = MOCK_EMAILS.filter((e) => e.subject.toLowerCase().includes(query.toLowerCase()));

  const columns: TableColumnsType<EmailRecord> = [
    { title: "Tiêu đề", dataIndex: "subject" },
    { title: "Người nhận", dataIndex: "recipientCount" },
    { title: "Trạng thái", dataIndex: "status", render: (s: EmailStatus) => <Tag color={statusColor[s]}>{EMAIL_STATUS_LABELS[s]}</Tag> },
    { title: "Gửi / Lên lịch", key: "date", render: (_, r) => r.sentAt ?? r.scheduledAt ?? "—" },
    { title: "Thao tác", key: "action", render: (_, r) => <Button size="small" onClick={() => router.push(`/emails/new?id=${r.id}`)}>Mở</Button> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý email" }]}
        searchPlaceholder="Tìm tiêu đề…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Soạn email", href: "/emails/new" }}
      />
      <div style={{ padding: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </div>
    </>
  );
}
