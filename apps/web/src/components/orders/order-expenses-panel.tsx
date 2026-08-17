"use client";

import { App, Button, Drawer, Form, Input, InputNumber, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { useState } from "react";
import { StatusBadge } from "@/components/shared/status-badge";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import { canReviewExpense, useExpenses } from "@/lib/expenses-store";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { expensePendingDraft, expenseReviewedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { usePayments } from "@/lib/payments-store";
import { tableIndexColumn } from "@/lib/table-index-column";
import type { Order, OrderExpense } from "@/lib/types";
import { useUsers } from "@/lib/users-store";

export function OrderExpensesPanel({ order }: { order: Order }) {
  const { message, modal } = App.useApp();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { getByOrderId } = usePayments();
  const { getByOrderId: getExpenses, totalApprovedChi, addExpense, reviewExpense } = useExpenses();
  const { addNotifications } = useNotifications();
  const [form] = Form.useForm();
  const [addOpen, setAddOpen] = useState(false);

  const closeAdd = () => {
    form.resetFields();
    setAddOpen(false);
  };

  const payment = getByOrderId(order.id);
  const thu = payment?.paidAmount ?? 0;
  const chi = totalApprovedChi(order.id);
  const rows = getExpenses(order.id);
  const canReview = currentUser
    ? canReviewExpense(Boolean(getEffectivePermissions(currentUser).expense_approvals?.edit))
    : false;

  return (
    <div>
      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            Tổng thu
          </Typography.Text>
          <div style={{ fontWeight: 600, color: ds.accentGreen }}>{formatVndDisplay(thu)}</div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            Tổng chi (đã duyệt)
          </Typography.Text>
          <div style={{ fontWeight: 600, color: ds.danger }}>{formatVndDisplay(chi)}</div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            Chênh lệch
          </Typography.Text>
          <div style={{ fontWeight: 600 }}>{formatVndDisplay(thu - chi)}</div>
        </div>
      </Space>

      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: 0 }}>
          Yêu cầu duyệt chi
        </Typography.Title>
        <Button type="primary" onClick={() => setAddOpen(true)}>
          + Thêm khoản chi
        </Button>
      </Space>
      <Drawer
        title="Thêm khoản chi"
        open={addOpen}
        onClose={() => confirmDiscardIfDirty(modal, form, closeAdd)}
        width={400}
        destroyOnHidden
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button onClick={() => confirmDiscardIfDirty(modal, form, closeAdd)}>Hủy</Button>
            <Button type="primary" onClick={() => form.submit()}>
              Gửi yêu cầu
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
            const created = addExpense({
              orderId: order.id,
              orderNumber: order.orderNumber,
              amount: Number(values.amount),
              title: values.title,
              note: values.note,
              requestedById: currentUser.id,
              requestedByName: currentUser.name,
            });
            const reviewerId = order.reviewerId;
            addNotifications(
              [currentUser.id, reviewerId],
              expensePendingDraft(order, created, currentUser.name),
            );
            if (!reviewerId) {
              message.warning("Đơn chưa có người duyệt chi — chỉ người gửi nhận thông báo.");
            }
            message.success("Đã gửi yêu cầu duyệt chi");
            closeAdd();
          }}
        >
          <Form.Item name="title" label="Nội dung chi" rules={[{ required: true, message: "Nhập nội dung" }]}>
            <Input placeholder="VD: Nộp 3tr Cục Dân sự" />
          </Form.Item>
          <Form.Item name="amount" label="Số tiền (VND)" rules={[{ required: true, message: "Nhập số tiền" }]}>
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Drawer>

      <Table<OrderExpense>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
          tableIndexColumn<OrderExpense>(),
          { title: "Nội dung", dataIndex: "title" },
          {
            title: "Số tiền",
            dataIndex: "amount",
            align: "center",
            render: (v: number) => formatVndDisplay(v),
          },
          {
            title: "Trạng thái",
            dataIndex: "status",
            render: (s: string) => <StatusBadge module="approvalRequest" status={s} />,
          },
          { title: "Người yêu cầu", dataIndex: "requestedByName" },
          { title: "Ngày", dataIndex: "requestedAt" },
          {
            title: "Thao tác",
            key: "actions",
            render: (_, r) => {
              if (r.status !== "pending") {
                return r.reviewedByName ?? "—";
              }
              if (!canReview || !currentUser) {
                return <Tag>Chỉ xem</Tag>;
              }
              return (
                <Space>
                  <Popconfirm
                    title="Duyệt khoản chi này?"
                    okText="Duyệt"
                    cancelText="Hủy"
                    onConfirm={() => {
                      reviewExpense(r.id, "approved", {
                        id: currentUser.id,
                        name: currentUser.name,
                      });
                      addNotifications(
                        [r.requestedById, order.reviewerId],
                        expenseReviewedDraft(r, "approved", currentUser.name),
                        currentUser.id,
                      );
                      message.success("Đã duyệt chi");
                    }}
                  >
                    <Button size="small" type="primary">
                      Duyệt
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="Từ chối khoản chi?"
                    okText="Từ chối"
                    cancelText="Hủy"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => {
                      reviewExpense(r.id, "rejected", {
                        id: currentUser.id,
                        name: currentUser.name,
                      });
                      addNotifications(
                        [r.requestedById, order.reviewerId],
                        expenseReviewedDraft(r, "rejected", currentUser.name),
                        currentUser.id,
                      );
                      message.success("Đã từ chối");
                    }}
                  >
                    <Button size="small" danger>
                      Từ chối
                    </Button>
                  </Popconfirm>
                </Space>
              );
            },
          },
        ]}
      />
    </div>
  );
}
