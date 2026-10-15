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
  Tag,
  Tooltip,
  Typography,
} from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useReloadOrderFinance, useApiHydrate } from "@/components/api-hydrator";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { DISPLAY_DATE_FORMAT } from "@/lib/format-date";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusBadge } from "@/components/shared/status-badge";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { apiErrorMessage } from "@/lib/http/message";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { paymentsApi } from "@/modules/payments/api";
import {
  createInstallmentPayment,
  knownPaymentId,
  markPaidErrorMessage,
  resolvePaymentIdForInstallment,
  takenPaymentIds,
  toPaymentMethod,
  verifyInstallmentPayment,
} from "@/modules/payments/mark-paid";
import type { PaymentInstallment } from "@/lib/types";
import { useT } from "@/lib/use-t";

export default function PaymentDetailPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { can } = useSession();
  const canVerify = can(PERMISSION.paymentVerify);
  const canVoid = can(PERMISSION.paymentVoid);
  const { getById, getByOrderId, ready, addInstallment, linkInstallmentPayment, markInstallmentPaid } = usePayments();
  const { getById: getOrder, orders } = useOrders();
  const { ready: hydrateReady, listMeta } = useApiHydrate();
  const reloadFinance = useReloadOrderFinance();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const markingRef = useRef<string | null>(null);
  const [form] = Form.useForm();
  const closeAdd = () => {
    form.resetFields();
    setAddOpen(false);
  };

  const payment = getById(id) ?? getByOrderId(id);
  const order = payment ? getOrder(payment.orderId) : undefined;
  const paymentsHydrated = Boolean(listMeta.payments) || (hydrateReady && ready);
  const paidCopy = useMemo(
    () => ({
      failed: t("payment.markPaidFailed"),
      forbidden: t("payment.markPaidForbidden"),
      missing: t("payment.markPaidMissing"),
    }),
    [t],
  );

  useEffect(() => {
    const orderId = payment?.orderId;
    if (!orderId) return;
    void reloadFinance(orderId);
  }, [payment?.orderId, reloadFinance]);

  const installmentColumns = useMemo(
    () => [
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
        render: (_: unknown, row: PaymentInstallment) => {
          if (row.status === "cancelled") return "—";
          const record = payment;
          return (
            <Space>
              {row.status !== "paid" ? (
                canVerify && record ? (
                  <Popconfirm
                    title={t("payment.markPaidTitle")}
                    description={t("payment.markPaidBody")}
                    okText={t("common.confirm")}
                    cancelText={t("common.cancel")}
                    onConfirm={async () => {
                      if (markingRef.current) return;
                      markingRef.current = row.id;
                      setMarkingId(row.id);
                      try {
                        const apiPaymentId = await resolvePaymentIdForInstallment(
                          record.orderId,
                          row,
                          takenPaymentIds(record.installments, row.id),
                        );
                        if (apiPaymentId !== row.paymentId) {
                          linkInstallmentPayment(record.id, row.id, apiPaymentId);
                        }
                        await verifyInstallmentPayment(record.orderId, apiPaymentId);
                        markInstallmentPaid(record.id, row.id, {
                          paymentId: apiPaymentId,
                          method: row.method,
                        });
                        await reloadFinance(record.orderId, { force: true });
                        message.success(t("payment.markedPaid"));
                      } catch (err) {
                        message.error(markPaidErrorMessage(err, paidCopy));
                      } finally {
                        markingRef.current = null;
                        setMarkingId(null);
                      }
                    }}
                  >
                    <Button size="small" loading={markingId === row.id}>
                      {t("payment.markPaidBtn")}
                    </Button>
                  </Popconfirm>
                ) : (
                  <Tooltip title={t("payment.markPaidForbidden")}>
                    <span>
                      <Button size="small" disabled>
                        {t("payment.markPaidBtn")}
                      </Button>
                    </span>
                  </Tooltip>
                )
              ) : null}
              {row.voidable && canVoid && record ? (
                <Popconfirm
                  title={t("payment.voidTitle")}
                  description={t("payment.voidBody")}
                  okText={t("payment.void")}
                  cancelText={t("common.cancel")}
                  okButtonProps={{ danger: true }}
                  onConfirm={async () => {
                    if (voidingId) return;
                    const apiPaymentId = knownPaymentId(row);
                    if (!apiPaymentId) {
                      message.error(t("payment.markPaidMissing"));
                      return;
                    }
                    setVoidingId(row.id);
                    try {
                      await paymentsApi.void(apiPaymentId);
                      await reloadFinance(record.orderId, { force: true });
                      message.success(t("payment.voided"));
                    } catch (err) {
                      message.error(apiErrorMessage(err, t("payment.voidFailed")));
                    } finally {
                      setVoidingId(null);
                    }
                  }}
                >
                  <Button size="small" danger loading={voidingId === row.id}>
                    {t("payment.void")}
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
          );
        },
      },
    ],
    [
      t,
      canVerify,
      canVoid,
      linkInstallmentPayment,
      markInstallmentPaid,
      markingId,
      message,
      paidCopy,
      payment,
      reloadFinance,
      voidingId,
    ],
  );

  if (!payment) {
    if (!paymentsHydrated) return <PageLoading />;
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
          {(payment.groupedOrderIds?.length ?? 1) > 1 ? (
            <Descriptions.Item label={t("order.sameContract")} span={2}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                {(payment.groupedOrderIds ?? [payment.orderId]).map((oid) => {
                  const sibling = orders.find((o) => o.id === oid);
                  return (
                    <Link key={oid} href={`/orders/${oid}`}>
                      {sibling ? `${sibling.orderNumber} · ${sibling.serviceName}` : oid}
                    </Link>
                  );
                })}
              </div>
            </Descriptions.Item>
          ) : order ? (
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
        <DataTable<PaymentInstallment>
          rowKey="id"
          size="small"
          dataSource={payment.installments}
          pagination={false}
          padded={false}
          dateFilterField="dueDate"
          enableLocalSearch
          emptyDescription={t("payment.noInstallments")}
          columns={installmentColumns}
          onRow={(row) =>
            row.status === "cancelled" ? { style: { opacity: 0.45 } } : {}
          }
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
            <Button type="primary" loading={saving} disabled={saving} onClick={() => form.submit()}>
              {t("payment.add")}
            </Button>
          </div>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            if (savingRef.current) return;
            savingRef.current = true;
            setSaving(true);
            let createdId: string | undefined;
            try {
              const created = await createInstallmentPayment({
                orderId: payment.orderId,
                amount: Number(values.amount),
                method: toPaymentMethod(values.method),
                dueDate: values.dueDate,
              });
              createdId = created.id;
              addInstallment(payment.id, {
                id: created.id,
                paymentId: created.id,
                voidable: true,
                amount: Number(created.amount),
                dueDate: values.dueDate,
                method: created.method,
                note: values.note,
                paidDate: values.markPaid ? new Date().toISOString().slice(0, 10) : undefined,
                status: values.markPaid ? "paid" : "pending",
              });
              if (values.markPaid) {
                if (!canVerify) throw new Error(t("payment.markPaidForbidden"));
                await paymentsApi.verify(created.id);
              }
              await reloadFinance(payment.orderId, { force: true });
              message.success(values.markPaid ? t("payment.markedPaid") : t("payment.addedInstallment"));
              closeAdd();
            } catch (err) {
              if (createdId) {
                message.error(markPaidErrorMessage(err, paidCopy));
                await reloadFinance(payment.orderId, { force: true }).catch(() => undefined);
                closeAdd();
              } else {
                message.error(apiErrorMessage(err, t("payment.addFailed")));
              }
            } finally {
              savingRef.current = false;
              setSaving(false);
            }
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
            <DatePicker style={{ width: "100%" }} format={DISPLAY_DATE_FORMAT} />
          </Form.Item>
          <Form.Item name="method" label={t("payment.methodLabel")}>
            <Select
              options={[
                { value: "BANK_TRANSFER", label: t("payment.bankTransfer") },
                { value: "CASH", label: t("payment.cash") },
                { value: "QR_PAYMENT", label: "QR" },
              ]}
            />
          </Form.Item>
          <Form.Item name="note" label={t("common.note")}>
            <Input.TextArea rows={2} />
          </Form.Item>
          {canVerify ? (
            <Form.Item name="markPaid" valuePropName="checked">
              <Checkbox>{t("payment.markPaidNow")}</Checkbox>
            </Form.Item>
          ) : null}
        </Form>
      </Drawer>
    </>
  );
}
