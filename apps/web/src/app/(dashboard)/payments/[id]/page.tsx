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
  Tag,
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
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { tableIndexColumn } from "@/lib/table-index-column";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import type { PaymentInstallment } from "@/lib/types";

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { getById, getByOrderId, ready, addInstallment, markInstallmentPaid } = usePayments();
  const { getById: getOrder } = useOrders();
  const [addOpen, setAddOpen] = useState(false);
  const [form] = Form.useForm();
  const closeAdd = () => {
    form.resetFields();
    setAddOpen(false);
  };

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
        <Space align="center" size="middle" style={{ marginBottom: 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {payment.orderNumber}
          </Typography.Title>
          <StatusBadge module="payment" status={payment.status} />
          {payment.remaining > 0 ? (
            <Tag color={payment.status === "overdue" ? "error" : "warning"}>
              Còn {formatVndDisplay(payment.remaining)}
            </Tag>
          ) : (
            <Tag color="success">Đã thu đủ</Tag>
          )}
        </Space>

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Đơn hàng">
            <Link href={`/orders/${payment.orderId}`}>{payment.orderNumber}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Khách hàng">
            <Link href={`/customers/${payment.customerId}`}>{payment.customerName}</Link>
          </Descriptions.Item>
          {order ? (
            <>
              <Descriptions.Item label="Dịch vụ">{order.serviceName}</Descriptions.Item>
              <Descriptions.Item label="Phụ trách">{order.assignedUserName}</Descriptions.Item>
            </>
          ) : null}
          <Descriptions.Item label="Tổng">{formatVndDisplay(payment.totalAmount)}</Descriptions.Item>
          <Descriptions.Item label="Đã TT">{formatVndDisplay(payment.paidAmount)}</Descriptions.Item>
          <Descriptions.Item label="Còn lại">{formatVndDisplay(payment.remaining)}</Descriptions.Item>
          <Descriptions.Item label="Đợt TT">{payment.installments.length}</Descriptions.Item>
        </Descriptions>

        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body }}>
          Các đợt thanh toán
        </Typography.Title>
        <Table
          rowKey="id"
          size="small"
          dataSource={payment.installments}
          pagination={false}
          locale={{ emptyText: "Chưa có đợt thanh toán." }}
          columns={[
            tableIndexColumn<PaymentInstallment>(),
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
            { title: "Ghi chú", dataIndex: "note", render: (v?: string) => v || "—" },
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
                    <Button size="small">Đánh dấu đã TT</Button>
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
        onClose={() => confirmDiscardIfDirty(modal, form, closeAdd)}
        width={400}
        destroyOnClose
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => confirmDiscardIfDirty(modal, form, closeAdd)}>Hủy</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Thêm
            </Button>
          </div>
        }
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
            closeAdd();
          }}
        >
          <Form.Item name="amount" label="Số tiền" rules={[{ required: true, message: "Nhập số tiền" }]}>
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item
            name="dueDate"
            label="Hạn thanh toán"
            rules={[{ required: true, message: "Chọn hạn thanh toán" }]}
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
                { value: "QR", label: "QR" },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="markPaid" valuePropName="checked">
            <Checkbox>Đã thanh toán ngay</Checkbox>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
