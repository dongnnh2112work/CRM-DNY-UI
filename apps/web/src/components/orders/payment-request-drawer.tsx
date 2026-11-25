"use client";

import { Alert, App, AutoComplete, Button, Drawer, Form, Input, InputNumber } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { expenseProjectLabel, useExpenses } from "@/lib/expenses-store";
import {
  duplicatePendingExpense,
  expensePayeeIssue,
  moneyAmountIssue,
  orderFinanceLocked,
  signedVndInputProps,
} from "@/lib/input-validators";
import { apiErrorMessage } from "@/lib/http/message";
import { useOrders } from "@/lib/orders-store";
import { useNotifications } from "@/lib/notifications-store";
import type { Order } from "@/lib/types";
import { useUsers } from "@/lib/users-store";
import { expensesApi } from "@/modules/expenses/api";
import { mapApiExpenseToUi } from "@/modules/expenses/map-to-ui";
import { useT } from "@/lib/use-t";

type FormValues = {
  project?: string;
  payeeName?: string;
  bankAccount?: string;
  bankName?: string;
  title?: string;
  amount: number;
  note?: string;
};

function orderProjectLabel(order: Pick<Order, "orderNumber" | "customerName">) {
  return `${order.orderNumber} — ${order.customerName}`;
}

export function PaymentRequestDrawer({
  open,
  onClose,
  lockedOrder,
}: {
  open: boolean;
  onClose: () => void;
  /** Khi tạo từ hồ sơ — không chọn dự án */
  lockedOrder?: Pick<Order, "id" | "orderNumber" | "customerName" | "stage">;
}) {
  const t = useT();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { currentUser } = useUsers();
  const { orders } = useOrders();
  const { expenses, addExpense, replaceExpenses } = useExpenses();
  const { refreshInbox } = useNotifications();

  useEffect(() => {
    if (!open) return;
    form.resetFields();
  }, [open, form]);

  const projectOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string }[] = [];
    const push = (value: string) => {
      const v = value.trim();
      if (!v || seen.has(v.toLowerCase())) return;
      seen.add(v.toLowerCase());
      options.push({ value: v });
    };
    for (const o of orders) {
      if (o.stage === "cancelled") continue;
      push(orderProjectLabel(o));
    }
    for (const e of expenses) {
      const label = expenseProjectLabel(e);
      if (label !== "—") push(label);
    }
    return options;
  }, [orders, expenses]);

  const close = () => {
    form.resetFields();
    onClose();
  };

  const watchedAmount = Form.useWatch("amount", form);
  const watchedPayee = Form.useWatch("payeeName", form);
  const watchedProject = Form.useWatch("project", form);
  const duplicate = useMemo(() => {
    const amount = Number(watchedAmount);
    if (!Number.isFinite(amount) || amount <= 0) return undefined;
    let orderId = lockedOrder?.id;
    if (!orderId && watchedProject) {
      const typed = String(watchedProject).trim();
      orderId = orders.find(
        (row) =>
          row.stage !== "cancelled" &&
          (row.id === typed || row.orderNumber === typed || orderProjectLabel(row).toLowerCase() === typed.toLowerCase()),
      )?.id;
    }
    if (!orderId) return undefined;
    return duplicatePendingExpense(expenses, {
      orderId,
      amount,
      payeeName: typeof watchedPayee === "string" ? watchedPayee : undefined,
    });
  }, [expenses, lockedOrder?.id, orders, watchedAmount, watchedPayee, watchedProject]);
  const lockedCancelled = Boolean(lockedOrder && orderFinanceLocked(lockedOrder));

  return (
    <Drawer
      title={t("expense.create")}
      open={open}
      onClose={() => confirmDiscardIfDirty(modal, form, close)}
      size={480}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={() => confirmDiscardIfDirty(modal, form, close)}>{t("common.cancel")}</Button>
          <Button type="primary" loading={saving} disabled={saving || lockedCancelled} onClick={() => form.submit()}>
            {t("expense.sendRequest")}
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
          if (!currentUser) {
            savingRef.current = false;
            setSaving(false);
            message.error(t("expense.notLoggedIn"));
            return;
          }
          let orderId: string | undefined;
          let orderNumber: string | undefined;
          let projectName = "";

          if (lockedOrder) {
            orderId = lockedOrder.id;
            orderNumber = lockedOrder.orderNumber;
            projectName = orderProjectLabel(lockedOrder);
          } else {
            const typed = (values.project ?? "").trim();
            const matched = typed
              ? orders.find(
                  (o) =>
                    o.id === typed ||
                    o.orderNumber === typed ||
                    orderProjectLabel(o).toLowerCase() === typed.toLowerCase(),
                )
              : undefined;
            if (matched) {
              orderId = matched.id;
              orderNumber = matched.orderNumber;
              projectName = orderProjectLabel(matched);
            } else {
              projectName = typed;
            }
          }

          const matchedOrder = orderId ? orders.find((row) => row.id === orderId) : undefined;
          if (lockedCancelled || (matchedOrder && orderFinanceLocked(matchedOrder))) {
            message.error(t("payment.cancelledLocked"));
            savingRef.current = false;
            setSaving(false);
            return;
          }
          const payeeName = values.payeeName?.trim() ?? "";
          const bankAccount = values.bankAccount?.trim() ?? "";
          const bankName = values.bankName?.trim() ?? "";
          const payeeIssue = expensePayeeIssue({ payeeName, bankAccount, bankName });
          if (payeeIssue === "payee") {
            message.error(t("expense.payeeRequired"));
            savingRef.current = false;
            setSaving(false);
            return;
          }
          if (payeeIssue === "account") {
            message.error(t("expense.bankRequired"));
            savingRef.current = false;
            setSaving(false);
            return;
          }
          if (payeeIssue === "bank") {
            message.error(t("expense.bankNameRequired"));
            savingRef.current = false;
            setSaving(false);
            return;
          }
          const amountIssue = moneyAmountIssue(values.amount);
          if (amountIssue) {
            message.error(amountIssue === "negative" ? t("payment.amountNegative") : t("payment.amountPositive"));
            savingRef.current = false;
            setSaving(false);
            return;
          }
          if (duplicatePendingExpense(expenses, { orderId, amount: Number(values.amount), payeeName })) {
            message.warning(t("expense.duplicatePending"));
            savingRef.current = false;
            setSaving(false);
            return;
          }

          const title =
            values.title?.trim() || projectName || t("expense.fallbackProject");
          const description = [bankName, bankAccount].filter(Boolean).join(" · ") || undefined;

          try {
            if (orderId) {
              const createdApi = await expensesApi.create({
                orderId,
                title,
                amount: Number(values.amount),
                note: values.note?.trim() || undefined,
                payeeName: payeeName || undefined,
                description,
              });
              const created = {
                ...mapApiExpenseToUi(createdApi, orderNumber),
                projectName: projectName || orderNumber || createdApi.title,
                payeeName,
                bankAccount,
                bankName,
              };
              replaceExpenses([created, ...expenses]);
              refreshInbox();
            } else {
              const created = addExpense({
                projectName: projectName || t("expense.fallbackProject"),
                amount: Number(values.amount),
                title,
                note: values.note?.trim() || undefined,
                requestedById: currentUser.id,
                requestedByName: currentUser.name,
                payeeName,
                bankAccount,
                bankName,
              });
            }
            message.success(t("expense.sent"));
            close();
          } catch (err) {
            message.error(apiErrorMessage(err, t("expense.sent")));
          } finally {
            savingRef.current = false;
            setSaving(false);
          }
        }}
      >
        {lockedCancelled ? (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} title={t("payment.cancelledLocked")} />
        ) : null}
        {duplicate ? (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={t("expense.duplicatePending")} />
        ) : null}
        <Form.Item label={t("common.requester")}>
          <Input value={currentUser?.name ?? ""} disabled />
        </Form.Item>
        {lockedOrder ? (
          <Form.Item label={t("common.project")}>
            <Input value={orderProjectLabel(lockedOrder)} disabled />
          </Form.Item>
        ) : (
          <Form.Item name="project" label={t("common.project")} extra={t("expense.projectExtra")}>
            <AutoComplete
              options={projectOptions}
              placeholder={t("expense.projectPlaceholder")}
              filterOption={(input, option) =>
                String(option?.value ?? "")
                  .toLowerCase()
                  .includes(input.trim().toLowerCase())
              }
            />
          </Form.Item>
        )}
        <Form.Item
          name="payeeName"
          label={t("common.payee")}
          rules={[{ required: true, whitespace: true, message: t("expense.payeeRequired") }]}
        >
          <Input placeholder={t("expense.payeePlaceholder")} />
        </Form.Item>
        <Form.Item
          name="bankAccount"
          label={t("expense.accountNo")}
          rules={[{ required: true, whitespace: true, message: t("expense.bankRequired") }]}
        >
          <Input placeholder={t("expense.accountPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="bankName"
          label={t("common.bank")}
          rules={[{ required: true, whitespace: true, message: t("expense.bankNameRequired") }]}
        >
          <Input placeholder={t("expense.bankPlaceholder")} />
        </Form.Item>
        <Form.Item name="title" label={t("common.content")}>
          <Input placeholder={t("expense.contentPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="amount"
          label={t("common.amount")}
          rules={[
            {
              validator: async (_, value) => {
                const issue = moneyAmountIssue(value);
                if (!issue) return;
                if (issue === "negative") throw new Error(t("payment.amountNegative"));
                throw new Error(issue === "not_positive" ? t("payment.amountPositive") : t("common.enterAmount"));
              },
            },
          ]}
        >
          <InputNumber {...signedVndInputProps} />
        </Form.Item>
        <Form.Item name="note" label={t("common.note")}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
