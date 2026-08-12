"use client";

import { App, Button, Form, Input, InputNumber, Popconfirm, Space, Table, Typography } from "antd";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { ds } from "@/lib/design-tokens";
import { canReviewExpense, useExpenses } from "@/lib/expenses-store";
import { useNotifications } from "@/lib/notifications-store";
import { usePayments } from "@/lib/payments-store";
import { useUsers } from "@/lib/users-store";
import { StatusBadge } from "@/components/shared/status-badge";
import type { Order, OrderExpense } from "@/lib/types";

export function OrderExpensesPanel({ order }: { order: Order }) {
  const { message } = App.useApp();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { getByOrderId } = usePayments();
  const { getByOrderId: getExpenses, totalApprovedChi, addExpense, reviewExpense } = useExpenses();
  const { addNotification } = useNotifications();
  const [form] = Form.useForm();

  const payment = getByOrderId(order.id);
  const thu = payment?.paidAmount ?? 0;
  const chi = totalApprovedChi(order.id);
  const rows = getExpenses(order.id);
  const canReview = currentUser
    ? canReviewExpense(
        currentUser,
        order.reviewerId,
        Boolean(getEffectivePermissions(currentUser).expense_approvals?.edit),
      )
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

      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body }}>
        Yêu cầu duyệt chi
      </Typography.Title>
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 480, marginBottom: 24 }}
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
          if (reviewerId) {
            addNotification({
              userId: reviewerId,
              type: "expense_pending",
              title: `Yêu cầu duyệt chi — ${order.orderNumber}`,
              body: `${currentUser.name}: ${created.title} (${formatVndDisplay(created.amount)})`,
              href: `/orders/${order.id}`,
              orderId: order.id,
              dedupeKey: `expense_pending:${created.id}`,
            });
          }
          message.success("Đã gửi yêu cầu duyệt chi");
          form.resetFields();
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
        <Button type="primary" htmlType="submit">
          Gửi yêu cầu
        </Button>
      </Form>

      <Table<OrderExpense>
        rowKey="id"
        size="small"
        pagination={false}
        dataSource={rows}
        columns={[
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
            render: (_, r) =>
              r.status === "pending" && canReview && currentUser ? (
                <Space>
                  <Popconfirm
                    title="Duyệt khoản chi này?"
                    okText="Duyệt"
                    onConfirm={() => {
                      reviewExpense(r.id, "approved", {
                        id: currentUser.id,
                        name: currentUser.name,
                      });
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
                    okButtonProps={{ danger: true }}
                    onConfirm={() => {
                      reviewExpense(r.id, "rejected", {
                        id: currentUser.id,
                        name: currentUser.name,
                      });
                      message.success("Đã từ chối");
                    }}
                  >
                    <Button size="small" danger>
                      Từ chối
                    </Button>
                  </Popconfirm>
                </Space>
              ) : (
                r.reviewedByName ?? "—"
              ),
          },
        ]}
      />
    </div>
  );
}
