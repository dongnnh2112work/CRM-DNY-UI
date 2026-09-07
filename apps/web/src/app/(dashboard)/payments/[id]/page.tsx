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
import { useMemo, useState } from "react";
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
import { useT } from "@/lib/use-t";

export default function PaymentDetailPage() {
  const t = useT();
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

  const installmentColumns = useMemo(
    () => [
      tableIndexColumn<PaymentInstallment>(),
      {
        title: t("common.amount"),
        dataIndex: "amount",
        align: "center" as const,
        render: (v: number) => formatVndDisplay(v),
      },
      { title: t("payment.dueDate"), dataIndex: "dueDate" },
      { title: t("payment.paidDate"), dataIndex: "paidDate", render: (v?: string) => v ?? "—" },
      { title: t("payment.method"), dataIndex: "method", render: (v?: string) => v ?? "—" },
      {
        title: t("common.status"),
        dataIndex: "status",
        render: (s: PaymentInstallment["status"]) => (
          <StatusBadge module="paymentInstallment" status={s} />
        ),
      },
      { title: t("common.note"), dataIndex: "note", render: (v?: string) => v || "—" },
      {
        title: t("common.actions"),
        key: "action",
        render: (_: unknown, row: PaymentInstallment) =>
          row.status !== "paid" ? (
            <Popconfirm
              title={t("payment.markPaidTitle")}
              description={t("payment.markPaidBody")}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
              onConfirm={() => {
                markInstallmentPaid(payment!.id, row.id);
                message.success(t("payment.markedPaid"));
              }}
            >
              <Button size="small">{t("payment.markPaidBtn")}</Button>
            </Popconfirm>
          ) : (
            "—"
          ),
      },
    ],
    [t, markInstallmentPaid, message, payment],
  );

  if (!ready) return <PageLoading />;
  if (!payment) {
    return (
      <EmptyState
        description={t("common.notFoundPayment")}
        action={{ label: t("common.back"), href: "/payments" }}
      />
    );
  }

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("payment.breadcrumb"), href: "/payments" }, { title: payment.orderNumber }]}>
        <Space wrap>
          <Button onClick={() => router.push(`/orders/${payment.orderId}`)}>{t("payment.viewOrder")}</Button>
          <Button type="primary" onClick={() => setAddOpen(true)}>
            {t("payment.addInstallmentCta")}
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
              {t("payment.remainingShort", { amount: formatVndDisplay(payment.remaining) })}
            </Tag>
          ) : (
            <Tag color="success">{t("payment.paidInFull")}</Tag>
          )}
        </Space>

        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label={t("common.order")}>
            <Link href={`/orders/${payment.orderId}`}>{payment.orderNumber}</Link>
          </Descriptions.Item>
          <Descriptions.Item label={t("common.customer")}>
            <Link href={`/customers/${payment.customerId}`}>{payment.customerName}</Link>
          </Descriptions.Item>
          {order ? (
            <>
              <Descriptions.Item label={t("common.service")}>{order.serviceName}</Descriptions.Item>
              <Descriptions.Item label={t("common.owner")}>{order.assignedUserName}</Descriptions.Item>
            </>
          ) : null}
          <Descriptions.Item label={t("payment.total")}>{formatVndDisplay(payment.totalAmount)}</Descriptions.Item>
          <Descriptions.Item label={t("payment.paid")}>{formatVndDisplay(payment.paidAmount)}</Descriptions.Item>
          <Descriptions.Item label={t("payment.remaining")}>{formatVndDisplay(payment.remaining)}</Descriptions.Item>
          <Descriptions.Item label={t("payment.installments")}>{payment.installments.length}</Descriptions.Item>
        </Descriptions>

        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body }}>
          {t("payment.installmentsSection")}
        </Typography.Title>
        <Table
          rowKey="id"
          size="small"
          dataSource={payment.installments}
          pagination={false}
          locale={{ emptyText: t("payment.noInstallments") }}
          columns={installmentColumns}
        />
      </div>

      <Drawer
        title={t("payment.addInstallment")}
        open={addOpen}
        onClose={() => confirmDiscardIfDirty(modal, form, closeAdd)}
        size={400}
        destroyOnClose
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => confirmDiscardIfDirty(modal, form, closeAdd)}>{t("common.cancel")}</Button>
            <Button type="primary" onClick={() => form.submit()}>
              {t("payment.add")}
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
            message.success(t("payment.addedInstallment"));
            closeAdd();
          }}
        >
          <Form.Item name="amount" label={t("common.amount")} rules={[{ required: true, message: t("common.enterAmount") }]}>
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item
            name="dueDate"
            label={t("payment.dueLabel")}
            rules={[{ required: true, message: t("payment.selectDue") }]}
            getValueFromEvent={(d: dayjs.Dayjs | null) => (d ? d.format("YYYY-MM-DD") : undefined)}
            getValueProps={(value: string | undefined) => ({
              value: value ? dayjs(value) : undefined,
            })}
          >
            <DatePicker style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="method" label={t("payment.methodLabel")}>
            <Select
              options={[
                { value: "Bank transfer", label: t("payment.bankTransfer") },
                { value: "Cash", label: t("payment.cash") },
                { value: "QR", label: "QR" },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label={t("common.note")}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="markPaid" valuePropName="checked">
            <Checkbox>{t("payment.markPaidNow")}</Checkbox>
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
