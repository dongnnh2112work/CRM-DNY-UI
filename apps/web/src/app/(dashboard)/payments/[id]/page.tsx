"use client";

import { Button, Descriptions, Drawer, Form, Input, InputNumber, Select, Table, Tag, Typography } from "antd";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_PAYMENTS } from "@/lib/mock-payments";
import { PAYMENT_STATUS_LABELS, type PaymentInstallment } from "@/lib/types";

const INSTALLMENT_STATUS_LABELS: Record<PaymentInstallment["status"], string> = {
  pending: "Chờ TT",
  paid: "Đã TT",
  overdue: "Quá hạn",
};

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const payment = MOCK_PAYMENTS.find((p) => p.id === id);
  const [addOpen, setAddOpen] = useState(false);

  if (!payment) return <div style={{ padding: 24 }}>Không tìm thấy bản ghi thanh toán.</div>;

  const statusColor = { pending: "warning", paid: "success", overdue: "error" } as const;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Thanh toán", href: "/payments" }, { title: payment.orderNumber }]}>
        <Button type="primary" onClick={() => setAddOpen(true)}>+ Thêm đợt TT</Button>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đơn hàng">{payment.orderNumber}</Descriptions.Item>
          <Descriptions.Item label="Khách hàng">{payment.customerName}</Descriptions.Item>
          <Descriptions.Item label="Tổng">{payment.totalAmount.toLocaleString()} ₫</Descriptions.Item>
          <Descriptions.Item label="Đã TT">{payment.paidAmount.toLocaleString()} ₫</Descriptions.Item>
          <Descriptions.Item label="Còn lại">{payment.remaining.toLocaleString()} ₫</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={payment.status === "paid" ? "success" : payment.status === "overdue" ? "error" : "warning"}>
              {PAYMENT_STATUS_LABELS[payment.status]}
            </Tag>
          </Descriptions.Item>
        </Descriptions>

        <Typography.Title level={5}>Các đợt thanh toán</Typography.Title>
        <Table
          rowKey="id"
          dataSource={payment.installments}
          pagination={false}
          columns={[
            { title: "Số tiền", dataIndex: "amount", render: (v: number) => `${v.toLocaleString()} ₫` },
            { title: "Hạn TT", dataIndex: "dueDate" },
            { title: "Ngày TT", dataIndex: "paidDate", render: (v?: string) => v ?? "—" },
            { title: "Phương thức", dataIndex: "method", render: (v?: string) => v ?? "—" },
            { title: "Trạng thái", dataIndex: "status", render: (s: PaymentInstallment["status"]) => <Tag color={statusColor[s]}>{INSTALLMENT_STATUS_LABELS[s]}</Tag> },
            { title: "Ghi chú", dataIndex: "note" },
          ]}
        />
      </div>

      <Drawer title="Thêm đợt thanh toán" open={addOpen} onClose={() => setAddOpen(false)} width={400}>
        <Form layout="vertical" onFinish={() => setAddOpen(false)}>
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
          <Form.Item name="dueDate" label="Hạn thanh toán" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="method" label="Phương thức TT">
            <Select options={[{ value: "Bank transfer" }, { value: "Cash" }, { value: "Credit card" }]} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Thêm</Button>
        </Form>
      </Drawer>
    </>
  );
}
