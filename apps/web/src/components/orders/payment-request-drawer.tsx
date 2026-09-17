"use client";

import { App, AutoComplete, Button, Drawer, Form, Input, InputNumber } from "antd";
import { useEffect, useMemo } from "react";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { expenseProjectLabel, useExpenses } from "@/lib/expenses-store";
import { vndInputProps } from "@/lib/format-vnd";
import { apiErrorMessage } from "@/lib/http/message";
import { expensePendingDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
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
  lockedOrder?: Pick<Order, "id" | "orderNumber" | "customerName">;
}) {
  const t = useT();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const { currentUser } = useUsers();
  const { orders } = useOrders();
  const { expenses, addExpense, replaceExpenses } = useExpenses();
  const { addNotifications } = useNotifications();

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
    for (const o of orders) push(orderProjectLabel(o));
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
          <Button type="primary" onClick={() => form.submit()}>
            {t("expense.sendRequest")}
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={async (values) => {
          if (!currentUser) {
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

          const title =
            values.title?.trim() || projectName || t("expense.fallbackProject");
          const payeeName = values.payeeName?.trim() ?? "";
          const bankAccount = values.bankAccount?.trim() ?? "";
          const bankName = values.bankName?.trim() ?? "";
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
              addNotifications([currentUser.id], expensePendingDraft(created, currentUser.name));
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
              addNotifications([currentUser.id], expensePendingDraft(created, currentUser.name));
            }
            message.success(t("expense.sent"));
            close();
          } catch (err) {
            message.error(apiErrorMessage(err, t("expense.sent")));
          }
        }}
      >
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
        <Form.Item name="payeeName" label={t("common.payee")}>
          <Input placeholder={t("expense.payeePlaceholder")} />
        </Form.Item>
        <Form.Item name="bankAccount" label={t("expense.accountNo")}>
          <Input placeholder={t("expense.accountPlaceholder")} />
        </Form.Item>
        <Form.Item name="bankName" label={t("common.bank")}>
          <Input placeholder={t("expense.bankPlaceholder")} />
        </Form.Item>
        <Form.Item name="title" label={t("common.content")}>
          <Input placeholder={t("expense.contentPlaceholder")} />
        </Form.Item>
        <Form.Item
          name="amount"
          label={t("common.amount")}
          rules={[{ required: true, message: t("common.enterAmount") }]}
        >
          <InputNumber {...vndInputProps} />
        </Form.Item>
        <Form.Item name="note" label={t("common.note")}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
