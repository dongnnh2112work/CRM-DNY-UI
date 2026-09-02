"use client";

import { App, AutoComplete, Button, Drawer, Form, Input, InputNumber } from "antd";
import { useEffect, useMemo } from "react";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { expenseProjectLabel, useExpenses } from "@/lib/expenses-store";
import { vndInputProps } from "@/lib/format-vnd";
import { expensePendingDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import type { Order } from "@/lib/types";
import { useUsers } from "@/lib/users-store";

type FormValues = {
  project?: string;
  payeeName: string;
  bankAccount: string;
  bankName: string;
  title: string;
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
  lockedOrder?: Pick<Order, "id" | "orderNumber" | "customerName" | "reviewerId">;
}) {
  const { message, modal } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const { currentUser } = useUsers();
  const { orders } = useOrders();
  const { expenses, addExpense } = useExpenses();
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
      title="Tạo đề nghị thanh toán"
      open={open}
      onClose={() => confirmDiscardIfDirty(modal, form, close)}
      width={480}
      destroyOnHidden
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button onClick={() => confirmDiscardIfDirty(modal, form, close)}>Hủy</Button>
          <Button type="primary" onClick={() => form.submit()}>
            Gửi đề nghị
          </Button>
        </div>
      }
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          if (!currentUser) {
            message.error("Chưa đăng nhập");
            return;
          }
          let orderId: string | undefined;
          let orderNumber: string | undefined;
          let projectName: string;
          let reviewerId: string | undefined;

          if (lockedOrder) {
            orderId = lockedOrder.id;
            orderNumber = lockedOrder.orderNumber;
            projectName = orderProjectLabel(lockedOrder);
            reviewerId = lockedOrder.reviewerId;
          } else {
            const typed = (values.project ?? "").trim();
            if (!typed) {
              message.error("Nhập hoặc chọn dự án");
              return;
            }
            const matched = orders.find(
              (o) =>
                o.id === typed ||
                o.orderNumber === typed ||
                orderProjectLabel(o).toLowerCase() === typed.toLowerCase(),
            );
            if (matched) {
              orderId = matched.id;
              orderNumber = matched.orderNumber;
              projectName = orderProjectLabel(matched);
              reviewerId = matched.reviewerId;
            } else {
              projectName = typed;
            }
          }

          const created = addExpense({
            orderId,
            orderNumber,
            projectName,
            amount: Number(values.amount),
            title: values.title.trim(),
            note: values.note?.trim() || undefined,
            requestedById: currentUser.id,
            requestedByName: currentUser.name,
            payeeName: values.payeeName,
            bankAccount: values.bankAccount,
            bankName: values.bankName,
          });
          addNotifications(
            [currentUser.id, reviewerId],
            expensePendingDraft(created, currentUser.name),
          );
          message.success("Đã gửi đề nghị thanh toán — chờ duyệt");
          close();
        }}
      >
        <Form.Item label="Người đề nghị">
          <Input value={currentUser?.name ?? ""} disabled />
        </Form.Item>
        {lockedOrder ? (
          <Form.Item label="Dự án">
            <Input value={orderProjectLabel(lockedOrder)} disabled />
          </Form.Item>
        ) : (
          <Form.Item
            name="project"
            label="Dự án"
            rules={[{ required: true, message: "Chọn hồ sơ hoặc nhập dự án" }]}
            extra="Chọn hồ sơ có sẵn, hoặc nhập dự án khác (VD: Mua văn phòng phẩm)."
          >
            <AutoComplete
              options={projectOptions}
              placeholder="Hồ sơ hoặc dự án khác…"
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
          label="Thanh toán cho"
          rules={[{ required: true, message: "Nhập người / đơn vị nhận" }]}
        >
          <Input placeholder="Tên người hoặc đơn vị nhận tiền" />
        </Form.Item>
        <Form.Item
          name="bankAccount"
          label="Số tài khoản"
          rules={[{ required: true, message: "Nhập số tài khoản" }]}
        >
          <Input placeholder="Số tài khoản nhận" />
        </Form.Item>
        <Form.Item name="bankName" label="Ngân hàng" rules={[{ required: true, message: "Nhập ngân hàng" }]}>
          <Input placeholder="VD: Vietcombank, Techcombank…" />
        </Form.Item>
        <Form.Item name="title" label="Nội dung" rules={[{ required: true, message: "Nhập nội dung" }]}>
          <Input placeholder="Nội dung thanh toán" />
        </Form.Item>
        <Form.Item name="amount" label="Số tiền (VND)" rules={[{ required: true, message: "Nhập số tiền" }]}>
          <InputNumber {...vndInputProps} />
        </Form.Item>
        <Form.Item name="note" label="Ghi chú">
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
