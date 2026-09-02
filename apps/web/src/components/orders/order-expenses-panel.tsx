"use client";

import { App, Button, Popconfirm, Space, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { PaymentRequestDrawer } from "@/components/orders/payment-request-drawer";
import { StatusBadge } from "@/components/shared/status-badge";
import { ds } from "@/lib/design-tokens";
import { canReviewExpense, useExpenses } from "@/lib/expenses-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { expenseReviewedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { buildOrderCashflow, formatYearMonth } from "@/lib/order-cashflow";
import { usePayments } from "@/lib/payments-store";
import { tableIndexColumn } from "@/lib/table-index-column";
import type { Order, OrderExpense } from "@/lib/types";
import { useUsers } from "@/lib/users-store";

export function OrderExpensesPanel({ order }: { order: Order }) {
  const { message } = App.useApp();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { getByOrderId } = usePayments();
  const { getByOrderId: getExpenses, reviewExpense } = useExpenses();
  const { addNotifications } = useNotifications();
  const [addOpen, setAddOpen] = useState(false);

  const payment = getByOrderId(order.id);
  const rows = getExpenses(order.id);
  const flow = useMemo(() => buildOrderCashflow(payment, rows), [payment, rows]);
  const canReview = currentUser
    ? canReviewExpense(Boolean(getEffectivePermissions(currentUser).expense_approvals?.edit))
    : false;

  return (
    <div>
      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: "0 0 8px" }}>
        Cả đơn
      </Typography.Title>
      <Space size="large" wrap style={{ marginBottom: 24 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            Tổng thu
          </Typography.Text>
          <div style={{ fontWeight: 600, color: ds.accentGreen }}>{formatVndDisplay(flow.thu)}</div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            Tổng chi (đã duyệt)
          </Typography.Text>
          <div style={{ fontWeight: 600, color: ds.danger }}>{formatVndDisplay(flow.chi)}</div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            Chênh lệch
          </Typography.Text>
          <div style={{ fontWeight: 600 }}>{formatVndDisplay(flow.net)}</div>
        </div>
      </Space>

      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: "0 0 8px" }}>
        Theo tháng
      </Typography.Title>
      <Table
        rowKey="month"
        size="small"
        pagination={false}
        style={{ marginBottom: 24, maxWidth: 560 }}
        dataSource={flow.months}
        locale={{ emptyText: "Chưa phát sinh thu/chi theo tháng." }}
        columns={[
          {
            title: "Tháng",
            dataIndex: "month",
            render: (m: string) => formatYearMonth(m),
          },
          {
            title: "Tổng thu",
            dataIndex: "thu",
            align: "right",
            render: (v: number) => (
              <span style={{ color: ds.accentGreen, fontWeight: 600 }}>{formatVndDisplay(v)}</span>
            ),
          },
          {
            title: "Tổng chi",
            dataIndex: "chi",
            align: "right",
            render: (v: number) => (
              <span style={{ color: ds.danger, fontWeight: 600 }}>{formatVndDisplay(v)}</span>
            ),
          },
          {
            title: "Chênh lệch",
            key: "net",
            align: "right",
            render: (_, r) => formatVndDisplay(r.thu - r.chi),
          },
        ]}
      />

      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: 0 }}>
          Đề nghị thanh toán
        </Typography.Title>
        <Button type="primary" onClick={() => setAddOpen(true)}>
          + Tạo đề nghị thanh toán
        </Button>
      </Space>
      <PaymentRequestDrawer
        open={addOpen}
        onClose={() => setAddOpen(false)}
        lockedOrder={order}
      />

      <Table<OrderExpense>
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 960 }}
        dataSource={rows}
        locale={{ emptyText: "Chưa có đề nghị thanh toán." }}
        columns={[
          tableIndexColumn<OrderExpense>(),
          { title: "Nội dung", dataIndex: "title", ellipsis: true },
          {
            title: "Số tiền",
            dataIndex: "amount",
            align: "center",
            render: (v: number) => formatVndDisplay(v),
          },
          {
            title: "Thanh toán cho",
            dataIndex: "payeeName",
            ellipsis: true,
            render: (v?: string) => v || "—",
          },
          {
            title: "STK",
            dataIndex: "bankAccount",
            render: (v?: string) => v || "—",
          },
          {
            title: "Ngân hàng",
            dataIndex: "bankName",
            ellipsis: true,
            render: (v?: string) => v || "—",
          },
          {
            title: "Trạng thái",
            dataIndex: "status",
            render: (s: string) => <StatusBadge module="approvalRequest" status={s} />,
          },
          { title: "Người đề nghị", dataIndex: "requestedByName" },
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
                    title="Duyệt đề nghị thanh toán này?"
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
                      message.success("Đã duyệt đề nghị");
                    }}
                  >
                    <Button size="small" type="primary">
                      Duyệt
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title="Từ chối đề nghị thanh toán?"
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
