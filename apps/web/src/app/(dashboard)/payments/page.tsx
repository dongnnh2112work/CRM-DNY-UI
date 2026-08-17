"use client";

import { App, Button, Select, type TableColumnsType } from "antd";
import Link from "next/link";
import { useCallback, useMemo, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { formatVndDisplay } from "@/lib/format-vnd";
import { usePayments } from "@/lib/payments-store";
import { getStatusMeta, getStatusOptions } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { PaymentRecord, PaymentStatus } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function PaymentsPage() {
  const { message } = App.useApp();
  const { payments } = usePayments();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    let list = [...payments];
    if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter);
    if (query.trim()) {
      list = list.filter((p) =>
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
    }
    return list;
  }, [payments, statusFilter, query]);

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);
  const hasActiveFilters = Boolean(query.trim()) || statusFilter !== "all";

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
  ];

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: "Quản lý thanh toán" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
      >
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            clearSelection();
          }}
          style={{ width: 180 }}
          options={[{ value: "all", label: "Tất cả trạng thái" }, ...getStatusOptions("payment")]}
        />
      </PageHeader>
      <DataTable<PaymentRecord>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={exporting}
        columnManagerKey="payments"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          hasActiveFilters && payments.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có bản ghi thanh toán nào."
        }
        emptyAction={
          hasActiveFilters && payments.length > 0
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
