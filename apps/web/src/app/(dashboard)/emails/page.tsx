"use client";

import { App, Button, Popconfirm, type TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useEmails } from "@/lib/emails-store";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { EmailRecord, EmailStatus } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

function emailDate(r: EmailRecord) {
  return r.sentAt ?? r.scheduledAt ?? "";
}

export default function EmailsPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { emails, setStatus, deleteEmails } = useEmails();
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const filtered = emails.filter((e) =>
    matchesTableQuery(query, [
      e.subject,
      e.recipientCount,
      e.recipients,
      e.status,
      getStatusMeta("email", e.status).label,
      e.sentAt,
      e.scheduledAt,
      e.body,
    ]),
  );
  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const bulkSetStatus = (status: EmailStatus) => {
    setStatus(selectedRowKeys.map(String), status);
    message.success(
      status === "sent"
        ? `Đã đánh dấu Đã gửi ${selectedCount} email`
        : `Đã đánh dấu Thất bại ${selectedCount} email`,
    );
    clearSelection();
  };

  const bulkDelete = () => {
    deleteEmails(selectedRowKeys.map(String));
    message.success(`Đã xóa ${selectedCount} email`);
    clearSelection();
  };

  const columns: TableColumnsType<EmailRecord> = [
    {
      title: "Tiêu đề",
      dataIndex: "subject",
      sorter: (a, b) => compareText(a.subject, b.subject),
    },
    {
      title: "Người nhận",
      dataIndex: "recipientCount",
      align: "center",
      sorter: (a, b) => a.recipientCount - b.recipientCount,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sorter: (a, b) => compareText(a.status, b.status),
      render: (s: EmailStatus) => <StatusBadge module="email" status={s} />,
    },
    {
      title: "Gửi / Lên lịch",
      key: "date",
      sorter: (a, b) => compareText(emailDate(a), emailDate(b)),
      render: (_, r) => r.sentAt ?? r.scheduledAt ?? "—",
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, r) => (
        <Button size="small" onClick={() => router.push(`/emails/new?id=${r.id}`)}>
          Mở
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý email" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ Soạn email", href: "/emails/new" }}
      />
      <DataTable<EmailRecord>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          query.trim() && emails.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có email nào."
        }
        emptyAction={
          query.trim() && emails.length > 0
            ? undefined
            : { label: "Soạn email", href: "/emails/new" }
        }
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Popconfirm
              title={`Đánh dấu Đã gửi ${selectedCount} email đã chọn?`}
              okText="Xác nhận"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("sent")}
            >
              <Button size="small">Đánh dấu Đã gửi</Button>
            </Popconfirm>
            <Popconfirm
              title={`Đánh dấu Thất bại ${selectedCount} email đã chọn?`}
              okText="Xác nhận"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("failed")}
            >
              <Button size="small">Đánh dấu Thất bại</Button>
            </Popconfirm>
            <Popconfirm
              title={`Xóa ${selectedCount} email đã chọn?`}
              description="Chỉ áp dụng các dòng đang chọn trên trang hiện tại."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={bulkDelete}
            >
              <Button size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          </BulkActionBar>
        }
      />
    </>
  );
}
