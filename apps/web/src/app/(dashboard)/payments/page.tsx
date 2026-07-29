"use client";

import { Button, Table, Tag, type TableColumnsType } from "antd";
import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_PAYMENTS } from "@/lib/mock-payments";
import { PAYMENT_STATUS_LABELS, type PaymentRecord, type PaymentStatus } from "@/lib/types";

const statusColor: Record<PaymentStatus, string> = { unpaid: "default", partial: "warning", paid: "success", overdue: "error" };

export default function PaymentsPage() {
  const [query, setQuery] = useState("");
  const filtered = MOCK_PAYMENTS.filter((p) =>
    [p.orderNumber, p.customerName].some((f) => f.toLowerCase().includes(query.toLowerCase())),
  );

  const columns: TableColumnsType<PaymentRecord> = [
    { title: "Mã đơn", dataIndex: "orderNumber", render: (v, r) => <Link href={`/payments/${r.id}`}>{v}</Link> },
    { title: "Khách hàng", dataIndex: "customerName" },
    { title: "Tổng", dataIndex: "totalAmount", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Đã TT", dataIndex: "paidAmount", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Còn lại", dataIndex: "remaining", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Trạng thái", dataIndex: "status", render: (s: PaymentStatus) => <Tag color={statusColor[s]}>{PAYMENT_STATUS_LABELS[s]}</Tag> },
    { title: "Đợt TT", key: "inst", render: (_, r) => r.installments.length },
    { title: "Thao tác", key: "action", render: (_, r) => <Button size="small"><Link href={`/payments/${r.id}`}>Chi tiết</Link></Button> },
  ];

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Quản lý thanh toán" }]} searchPlaceholder="Tìm đơn, khách hàng…" onSearch={setQuery} searchValue={query} />
      <div style={{ padding: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </div>
    </>
  );
}
