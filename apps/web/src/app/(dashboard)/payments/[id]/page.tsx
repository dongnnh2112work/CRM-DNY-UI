"use client";

import { App, Button, Checkbox, Descriptions, Drawer, Form, Input, InputNumber, Select, Space, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { PAYMENT_STATUS_LABELS, type PaymentInstallment } from "@/lib/types";

const INSTALLMENT_STATUS_LABELS: Record<PaymentInstallment["status"], string> = {
  pending: "Chờ TT",
  paid: "Đã TT",
  overdue: "Quá hạn",
};

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, getByOrderId, ready, addInstallment, markInstallmentPaid } = usePayments();
  const { getById: getOrder } = useOrders();
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();

  const payment = getById(id) ?? getByOrderId(id);
  const order = payment ? getOrder(payment.orderId) : undefined;

  if (!ready) return null;
  if (!payment) return <div style={{ padding: 24 }}>Không tìm thấy bản ghi thanh toán.</div>;

  const statusColor = { pending: "warning", paid: "success", overdue: "error" } as const;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Thanh toán", href: "/payments" }, { title: payment.orderNumber }]}>
        <Space wrap>
          <Button onClick={() => router.push(`/orders/${payment.orderId}`)}>Xem đơn hàng</Button>
          <Button type="primary" onClick={() => setAddOpen(true)}>
            + Thêm đợt TT
          </Button>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đơn hàng">
            <Link href={`/orders/${payment.orderId}`}>{payment.orderNumber}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng">
            <Link href={`/customers/${payment.customerId}`}>{payment.customerName}</Link>
          </Descriptions.Item>
          {order && (
            <>
              <Descriptions.Item label="Dịch vụ">{order.serviceName}</Descriptions.Item>
              <Descriptions.Item label="Giai đoạn đơn">{order.stage}</Descriptions.Item>
              <Descriptions.Item label="Kênh">{order.channel.toUpperCase()}</Descriptions.Item>
              <Descriptions.Item label="Phụ trách">{order.assignedUserName}</Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="Tổng">{formatVndDisplay(payment.totalAmount)}</Descriptions.Item>
          <Descriptions.Item label="Đã TT">{formatVndDisplay(payment.paidAmount)}</Descriptions.Item>
          <Descriptions.Item label="Còn lại">{formatVndDisplay(payment.remaining)}</Descriptions.Item>
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
            {
              title: "Số tiền",
              dataIndex: "amount",
              render: (v: number) => formatVndDisplay(v),
            },
            { title: "Hạn TT", dataIndex: "dueDate" },
            { title: "Ngày TT", dataIndex: "paidDate", render: (v?: string) => v ?? "—" },
            { title: "Phương thức", dataIndex: "method", render: (v?: string) => v ?? "—" },
            {
              title: "Trạng thái",
              dataIndex: "status",
              render: (s: PaymentInstallment["status"]) => (
                <Tag color={statusColor[s]}>{INSTALLMENT_STATUS_LABELS[s]}</Tag>
              ),
            },
            { title: "Ghi chú", dataIndex: "note" },
            {
              title: "Thao tác",
              key: "action",
              render: (_, row: PaymentInstallment) =>
                row.status !== "paid" ? (
                  <Button
                    size="small"
                    type="link"
                    onClick={() => {
                      markInstallmentPaid(payment.id, row.id);
                      message.success("Đã ghi nhận thanh toán");
                    }}
                  >
                    Đánh dấu đã TT
                  </Button>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </div>

      <Drawer
        title="Thêm đợt thanh toán"
        open={addOpen}
        onClose={() => setAddOpen(false)}
        width={400}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            addInstallment(payment.id, {
              amount: Number(values.amount),
              dueDate: values.dueDate,
              method: values.method,
              note: values.note,
              paidDate: values.markPaid ? new Date().toISOString().slice(0, 10) : undefined,
              status: values.markPaid ? "paid" : "pending",
            });
            message.success("Đã thêm đợt thanh toán");
            form.resetFields();
            setAddOpen(false);
          }}
        >
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true }]}>
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item name="dueDate" label="Hạn thanh toán" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="method" label="Phương thức TT">
            <Select
              options={[
                { value: "Bank transfer", label: "Chuyển khoản" },
                { value: "Cash", label: "Tiền mặt" },
                { value: "Credit card", label: "Thẻ" },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="markPaid" valuePropName="checked">
            <Checkbox>Đã thanh toán ngay</Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            Thêm
          </Button>
        </Form>
      </Drawer>
    </>
  );
}
