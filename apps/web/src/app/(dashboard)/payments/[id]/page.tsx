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
  canEditInstallment,
  createInstallmentPayment,
  InstallmentPaymentMissing,
  InstallmentUpdateFailed,
  knownPaymentId,
  markPaidErrorMessage,
  resolvePaymentIdForInstallment,
  takenPaymentIds,
  toPaymentMethod,
  updateInstallmentPayment,
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
  const {
    getById,
    getByOrderId,
    ready,
    addInstallment,
    linkInstallmentPayment,
    replaceInstallment,
    patchInstallmentNote,
    markInstallmentPaid,
  } = usePayments();
  const { getById: getOrder, orders } = useOrders();
  const { ready: hydrateReady, listMeta } = useApiHydrate();
  const reloadFinance = useReloadOrderFinance();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentInstallment | null>(null);
  const editingRef = useRef<PaymentInstallment | null>(null);
  const [saving, setSaving] = useState(false);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const savingRef = useRef(false);
  const markingRef = useRef<string | null>(null);
  const [form] = Form.useForm();
  const closeAdd = () => {
    form.resetFields();
    editingRef.current = null;
    setEditing(null);
    setAddOpen(false);
  };
  const openAdd = () => {
    editingRef.current = null;
    setEditing(null);
    setAddOpen(true);
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
          const editable = canEditInstallment(row, can);
          return (
            <Space>
              {editable ? (
                <Button
                  size="small"
                  onClick={() => {
                    editingRef.current = row;
                    setEditing(row);
                    setAddOpen(true);
                  }}
                >
                  {t("common.edit")}
                </Button>
              ) : (
                <Tooltip title={t("payment.editForbidden")}>
                  <span>
                    <Button size="small" disabled>
                      {t("common.edit")}
                    </Button>
                  </span>
                </Tooltip>
              )}
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
      can,
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
          <Button type="primary" onClick={openAdd}>
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
        title={editing ? t("payment.editTitle") : t("payment.addInstallment")}
        open={addOpen}
        afterOpenChange={(open) => {
          if (!open) return;
          const row = editingRef.current;
          if (!row) {
            form.resetFields();
            return;
          }
          form.setFieldsValue({
            amount: row.amount,
            dueDate: row.dueDate,
            method: row.method ? toPaymentMethod(row.method) : undefined,
            note: row.note,
            markPaid: row.status === "paid",
          });
        }}
        onClose={() => confirmDiscardIfDirty(modal, form, closeAdd)}
        size={400}
        destroyOnClose
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => confirmDiscardIfDirty(modal, form, closeAdd)}>{t("common.cancel")}</Button>
            <Button type="primary" loading={saving} disabled={saving} onClick={() => form.submit()}>
              {editing ? t("common.save") : t("payment.add")}
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
              const row = editingRef.current;
              if (row) {
                if (values.markPaid && !canVerify) throw new Error(t("payment.markPaidForbidden"));
                let previousPaymentId = knownPaymentId(row);
                if (!previousPaymentId && row.method) {
                  try {
                    previousPaymentId = await resolvePaymentIdForInstallment(
                      payment.orderId,
                      row,
                      takenPaymentIds(payment.installments, row.id),
                    );
                  } catch (err) {
                    if (!(err instanceof InstallmentPaymentMissing)) throw err;
                  }
                }
                const result = await updateInstallmentPayment({
                  orderId: payment.orderId,
                  previousPaymentId,
                  previousScheduleLineId: row.scheduleLineId,
                  previousAmount: row.amount,
                  previousDueDate: row.dueDate,
                  previousMethod: row.method ? toPaymentMethod(row.method) : undefined,
                  wasPaid: row.status === "paid",
                  amount: Number(values.amount),
                  method: values.method ? toPaymentMethod(values.method) : undefined,
                  dueDate: values.dueDate,
                  markPaid: Boolean(values.markPaid),
                });
                const nextId = result.payment?.id ?? row.id;
                replaceInstallment(payment.id, row.id, {
                  ...row,
                  id: nextId,
                  paymentId: result.payment?.id ?? row.paymentId,
                  amount: Number(values.amount),
                  dueDate: values.dueDate ?? row.dueDate,
                  method: result.payment?.method ?? row.method,
                  note: values.note,
                  status: values.markPaid ? "paid" : "pending",
                  paidDate: values.markPaid ? new Date().toISOString().slice(0, 10) : undefined,
                  voidable: Boolean(result.payment),
                });
                await reloadFinance(payment.orderId, { force: true });
                if (values.note) {
                  patchInstallmentNote(payment.id, result.payment?.id ?? previousPaymentId ?? row.id, String(values.note));
                }
                if (result.payment && !result.previousVoided) message.warning(t("payment.voidPreviousFailed"));
                else message.success(t("payment.updated"));
                closeAdd();
                return;
              }
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
              if (editingRef.current) {
                message.error(
                  err instanceof InstallmentUpdateFailed
                    ? t("payment.updateFailed")
                    : markPaidErrorMessage(err, { ...paidCopy, failed: t("payment.updateFailed") }),
                );
              } else if (createdId) {
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
          <Form.Item
            name="method"
            label={t("payment.methodLabel")}
            rules={
              editing && knownPaymentId(editing)
                ? [{ required: true, message: t("payment.selectMethod") }]
                : []
            }
          >
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
          {canVerify || editing ? (
            <Form.Item name="markPaid" valuePropName="checked">
              <Checkbox>{editing ? t("payment.markPaidToggle") : t("payment.markPaidNow")}</Checkbox>
            </Form.Item>
          ) : null}
        </Form>
      </Drawer>
    </>
  );
}
