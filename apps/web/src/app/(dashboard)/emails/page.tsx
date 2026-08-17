"use client";

import { App, Button, Popconfirm, Select, type TableColumnsType } from "antd";
import Link from "next/link";
import { useCallback, useMemo, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { useEmails } from "@/lib/emails-store";
import { getStatusMeta, getStatusOptions } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { EmailRecord, EmailStatus } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

function emailDate(r: EmailRecord) {
  return r.sentAt ?? r.scheduledAt ?? "";
}

function recipientsLabel(r: EmailRecord) {
  if (!r.recipients?.length) return "—";
  if (r.recipients.length === 1) return r.recipients[0];
  return `${r.recipients[0]} +${r.recipients.length - 1}`;
}

export default function EmailsPage() {
  const { message } = App.useApp();
  const { emails, setStatus, deleteEmails } = useEmails();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);

  const filtered = useMemo(() => {
    let list = [...emails];
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    if (query.trim()) {
      list = list.filter((e) =>
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
    }
    return list;
  }, [emails, statusFilter, query]);

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);
  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== "all";

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
      render: (v, r) => <Link href={`/emails/new?id=${r.id}`}>{v}</Link>,
    },
    {
      title: "Người nhận",
      key: "recipients",
      ellipsis: true,
      sorter: (a, b) => a.recipientCount - b.recipientCount,
      render: (_, r) => recipientsLabel(r),
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
  ];

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: "Quản lý email" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ Email mới", href: "/emails/new" }}
      >
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            clearSelection();
          }}
          style={{ width: 180 }}
          options={[{ value: "all", label: "Tất cả trạng thái" }, ...getStatusOptions("email")]}
        />
      </PageHeader>
      <DataTable<EmailRecord>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="emails"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          hasActiveFilters && emails.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có email nào."
        }
        emptyAction={
          hasActiveFilters && emails.length > 0
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
