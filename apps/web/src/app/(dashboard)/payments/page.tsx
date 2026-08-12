"use client";

import { App, Button, type TableColumnsType } from "antd";
import Link from "next/link";
import { useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { formatVndDisplay } from "@/lib/format-vnd";
import { usePayments } from "@/lib/payments-store";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { PaymentRecord, PaymentStatus } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function PaymentsPage() {
  const { message } = App.useApp();
  const { payments } = usePayments();
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [exporting, setExporting] = useState(false);

  const filtered = payments.filter((p) =>
    matchesTableQuery(query, [
      p.orderNumber,
      p.customerName,
      p.totalAmount,
      p.paidAmount,
      p.remaining,
      p.status,
      getStatusMeta("payment", p.status).label,
      p.installments.length,
    ]),
  );

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const bulkExport = async () => {
    setExporting(true);
    try {
      const rows = payments
        .filter((p) => selectedRowKeys.includes(p.id))
        .map((p) => ({
          "Mã đơn": p.orderNumber,
          "Khách hàng": p.customerName,
          Tổng: p.totalAmount,
          "Đã TT": p.paidAmount,
          "Còn lại": p.remaining,
          "Trạng thái": p.status,
        }));
      await exportRowsToXlsx(`payments-selected-${Date.now()}.xlsx`, rows);
      message.success(`Đã xuất ${selectedCount} bản ghi thanh toán`);
    } finally {
      setExporting(false);
    }
  };

  const columns: TableColumnsType<PaymentRecord> = [
    {
      title: "Mã đơn",
      dataIndex: "orderNumber",
      sorter: (a, b) => compareText(a.orderNumber, b.orderNumber),
      render: (v, r) => <Link href={`/payments/${r.id}`}>{v}</Link>,
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      sorter: (a, b) => compareText(a.customerName, b.customerName),
      render: (v, r) => <Link href={`/customers/${r.customerId}`}>{v}</Link>,
    },
    {
      title: "Tổng",
      dataIndex: "totalAmount",
      align: "center",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Đã TT",
      dataIndex: "paidAmount",
      align: "center",
      sorter: (a, b) => a.paidAmount - b.paidAmount,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Còn lại",
      dataIndex: "remaining",
      align: "center",
      sorter: (a, b) => a.remaining - b.remaining,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sorter: (a, b) => compareText(a.status, b.status),
      render: (s: PaymentStatus) => <StatusBadge module="payment" status={s} />,
    },
    {
      title: "Đợt TT",
      key: "inst",
      align: "center",
      sorter: (a, b) => a.installments.length - b.installments.length,
      render: (_, r) => r.installments.length,
    },
    {
      title: "Đơn hàng",
      key: "order",
      render: (_, r) => (
        <Button size="small">
          <Link href={`/orders/${r.orderId}`}>Mở đơn</Link>
        </Button>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, r) => (
        <Button size="small">
          <Link href={`/payments/${r.id}`}>Chi tiết</Link>
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý thanh toán" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
      />
      <DataTable<PaymentRecord>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={exporting}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          query.trim() && payments.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có bản ghi thanh toán nào."
        }
        emptyAction={
          query.trim() && payments.length > 0
            ? undefined
            : { label: "Tạo đơn hàng", href: "/orders/new" }
        }
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Button size="small" onClick={bulkExport}>
              Xuất Excel
            </Button>
          </BulkActionBar>
        }
      />
    </>
  );
}
