"use client";

import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tabs,
  Typography,
} from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import type { PaymentInstallment } from "@/lib/types";

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

  if (!ready) return <PageLoading />;
  if (!payment) {
    return (
      <EmptyState
        description="Không tìm thấy bản ghi thanh toán."
        action={{ label: "Quay lại danh sách", href: "/payments" }}
      />
    );
  }

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
        <Tabs
          items={[
            {
              key: "info",
              label: "Thông tin",
              children: (
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
                    <StatusBadge module="payment" status={payment.status} />
                  </Descriptions.Item>
                </Descriptions>
              ),
            },
            {
              key: "notes",
              label: "Ghi chú / Liên quan",
              children: (
                <Typography.Paragraph type="secondary">
                  Ghi chú nội bộ và lịch sử liên quan sẽ hiển thị tại đây.{" "}
                  <Link href={`/orders/${payment.orderId}`}>Mở đơn hàng</Link>
                  {" · "}
                  <Link href={`/customers/${payment.customerId}`}>Mở khách hàng</Link>
                </Typography.Paragraph>
              ),
            },
          ]}
        />

        <Typography.Title level={5}>Các đợt thanh toán</Typography.Title>
        <Table
          rowKey="id"
          dataSource={payment.installments}
          pagination={false}
          columns={[
            {
              title: "Số tiền",
              dataIndex: "amount",
              align: "center",
              render: (v: number) => formatVndDisplay(v),
            },
            { title: "Hạn TT", dataIndex: "dueDate" },
            { title: "Ngày TT", dataIndex: "paidDate", render: (v?: string) => v ?? "—" },
            { title: "Phương thức", dataIndex: "method", render: (v?: string) => v ?? "—" },
            {
              title: "Trạng thái",
              dataIndex: "status",
              render: (s: PaymentInstallment["status"]) => (
                <StatusBadge module="paymentInstallment" status={s} />
              ),
            },
            { title: "Ghi chú", dataIndex: "note" },
            {
              title: "Thao tác",
              key: "action",
              render: (_, row: PaymentInstallment) =>
                row.status !== "paid" ? (
                  <Popconfirm
                    title="Đánh dấu đã thanh toán?"
                    description="Đợt này sẽ chuyển sang trạng thái Đã TT."
                    okText="Xác nhận"
                    cancelText="Hủy"
                    onConfirm={() => {
                      markInstallmentPaid(payment.id, row.id);
                      message.success("Đã ghi nhận thanh toán");
                    }}
                  >
                    <Button size="small" type="link">
                      Đánh dấu đã TT
                    </Button>
                  </Popconfirm>
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
          <Form.Item
            name="dueDate"
            label="Hạn thanh toán"
            rules={[{ required: true }]}
            getValueFromEvent={(d: dayjs.Dayjs | null) => (d ? d.format("YYYY-MM-DD") : undefined)}
            getValueProps={(value: string | undefined) => ({
              value: value ? dayjs(value) : undefined,
            })}
          >
            <DatePicker style={{ width: "100%" }} />
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
