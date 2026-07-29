"use client";

import { Button, Table, Tag, type TableColumnsType } from "antd";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_VAT_INVOICES } from "@/lib/mock-vat";
import type { VatInvoice, VatStatus } from "@/lib/types";

const VAT_STATUS_LABELS: Record<VatStatus, string> = {
  draft: "Nháp",
  issued: "Đã xuất",
  cancelled: "Đã hủy",
};

const statusColor: Record<VatStatus, string> = { draft: "default", issued: "success", cancelled: "error" };

export default function VatPage() {
  const [query, setQuery] = useState("");
  const filtered = MOCK_VAT_INVOICES.filter((v) =>
    [v.invoiceNumber, v.customerName, v.orderNumber].some((f) => f.toLowerCase().includes(query.toLowerCase())),
  );

  const columns: TableColumnsType<VatInvoice> = [
    { title: "Số hóa đơn VAT", dataIndex: "invoiceNumber" },
    { title: "Khách hàng", dataIndex: "customerName" },
    { title: "Đơn hàng", dataIndex: "orderNumber" },
    { title: "Tiền hàng", dataIndex: "amount", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Thuế", dataIndex: "taxAmount", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Tổng", dataIndex: "totalAmount", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Ngày xuất", dataIndex: "issueDate" },
    { title: "Trạng thái", dataIndex: "status", render: (s: VatStatus) => <Tag color={statusColor[s]}>{VAT_STATUS_LABELS[s]}</Tag> },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý VAT" }]}
        searchPlaceholder="Tìm hóa đơn, khách hàng…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Hóa đơn VAT mới", href: "/vat/new" }}
      />
      <div style={{ padding: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </div>
    </>
  );
}
