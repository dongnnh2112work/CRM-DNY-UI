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
import { apiErrorMessage } from "@/lib/http/message";
import { expensesApi } from "@/modules/expenses/api";
import { useT } from "@/lib/use-t";

export function OrderExpensesPanel({ order }: { order: Order }) {
  const t = useT();
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
    ? canReviewExpense({
        hasExpenseApprovePermission: Boolean(getEffectivePermissions(currentUser).expense_approvals?.edit),
        currentUserId: currentUser.id,
        reviewerId: order.reviewerId,
      })
    : false;

  const monthColumns = useMemo(
    () => [
      {
        title: t("common.month"),
        dataIndex: "month",
        render: (m: string) => formatYearMonth(m),
      },
      {
        title: t("order.totalThu"),
        dataIndex: "thu",
        align: "right" as const,
        render: (v: number) => (
          <span style={{ color: ds.accentGreen, fontWeight: 600 }}>{formatVndDisplay(v)}</span>
        ),
      },
      {
        title: t("order.totalChiApproved"),
        dataIndex: "chi",
        align: "right" as const,
        render: (v: number) => (
          <span style={{ color: ds.danger, fontWeight: 600 }}>{formatVndDisplay(v)}</span>
        ),
      },
      {
        title: t("order.diff"),
        key: "net",
        align: "right" as const,
        render: (_: unknown, r: { thu: number; chi: number }) => formatVndDisplay(r.thu - r.chi),
      },
    ],
    [t],
  );

  const expenseColumns = useMemo(
    () => [
      tableIndexColumn<OrderExpense>(),
      { title: t("common.content"), dataIndex: "title", ellipsis: true },
      {
        title: t("common.amount"),
        dataIndex: "amount",
        align: "center" as const,
        render: (v: number) => formatVndDisplay(v),
      },
      {
        title: t("common.payee"),
        dataIndex: "payeeName",
        ellipsis: true,
        render: (v?: string) => v || "—",
      },
      {
        title: t("expense.accountNo"),
        dataIndex: "bankAccount",
        render: (v?: string) => v || "—",
      },
      {
        title: t("common.bank"),
        dataIndex: "bankName",
        ellipsis: true,
        render: (v?: string) => v || "—",
      },
      {
        title: t("common.status"),
        dataIndex: "status",
        render: (s: string) => <StatusBadge module="approvalRequest" status={s} />,
      },
      { title: t("common.requester"), dataIndex: "requestedByName" },
      { title: t("common.date"), dataIndex: "requestedAt" },
      {
        title: t("common.actions"),
        key: "actions",
        render: (_: unknown, r: OrderExpense) => {
          if (r.status !== "pending") {
            return r.reviewedByName ?? "—";
          }
          if (!canReview || !currentUser) {
            return <Tag>{order.reviewerId ? t("common.viewOnly") : t("expense.onlyReviewer")}</Tag>;
          }
          return (
            <Space>
              <Popconfirm
                title={t("expense.approveTitle")}
                okText={t("common.approve")}
                cancelText={t("common.cancel")}
                onConfirm={async () => {
                  try {
                    await expensesApi.approve(r.id);
                    reviewExpense(r.id, "approved", {
                      id: currentUser.id,
                      name: currentUser.name,
                    });
                    addNotifications(
                      [r.requestedById, order.reviewerId],
                      expenseReviewedDraft(r, "approved", currentUser.name),
                      currentUser.id,
                    );
                    message.success(t("expense.approved"));
                  } catch (err) {
                    message.error(apiErrorMessage(err, t("expense.approved")));
                  }
                }}
              >
                <Button size="small" type="primary">
                  {t("common.approve")}
                </Button>
              </Popconfirm>
              <Popconfirm
                title={t("expense.rejectTitle")}
                okText={t("common.reject")}
                cancelText={t("common.cancel")}
                okButtonProps={{ danger: true }}
                onConfirm={async () => {
                  try {
                    await expensesApi.reject(r.id);
                    reviewExpense(r.id, "rejected", {
                      id: currentUser.id,
                      name: currentUser.name,
                    });
                    addNotifications(
                      [r.requestedById, order.reviewerId],
                      expenseReviewedDraft(r, "rejected", currentUser.name),
                      currentUser.id,
                    );
                    message.success(t("expense.rejected"));
                  } catch (err) {
                    message.error(apiErrorMessage(err, t("expense.rejected")));
                  }
                }}
              >
                <Button size="small" danger>
                  {t("common.reject")}
                </Button>
              </Popconfirm>
            </Space>
          );
        },
      },
    ],
    [t, canReview, currentUser, addNotifications, message, order.reviewerId, reviewExpense],
  );

  return (
    <div>
      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: "0 0 8px" }}>
        {t("order.wholeOrder")}
      </Typography.Title>
      <Space size="large" wrap style={{ marginBottom: 24 }}>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            {t("order.totalThu")}
          </Typography.Text>
          <div style={{ fontWeight: 600, color: ds.accentGreen }}>{formatVndDisplay(flow.thu)}</div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            {t("order.totalChiApproved")}
          </Typography.Text>
          <div style={{ fontWeight: 600, color: ds.danger }}>{formatVndDisplay(flow.chi)}</div>
        </div>
        <div>
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            {t("order.diff")}
          </Typography.Text>
          <div style={{ fontWeight: 600 }}>{formatVndDisplay(flow.net)}</div>
        </div>
      </Space>

      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: "0 0 8px" }}>
        {t("order.byMonth")}
      </Typography.Title>
      <Table
        rowKey="month"
        size="small"
        pagination={false}
        style={{ marginBottom: 24, maxWidth: 560 }}
        dataSource={flow.months}
        locale={{ emptyText: t("order.cashflowEmpty") }}
        columns={monthColumns}
      />

      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 16 }} wrap>
        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: 0 }}>
          {t("nav.expenses")}
        </Typography.Title>
        <Button type="primary" onClick={() => setAddOpen(true)}>
          {t("expense.newCta")}
        </Button>
      </Space>
      <PaymentRequestDrawer open={addOpen} onClose={() => setAddOpen(false)} lockedOrder={order} />

      <Table<OrderExpense>
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 960 }}
        dataSource={rows}
        locale={{ emptyText: t("expense.empty") }}
        columns={expenseColumns}
      />
    </div>
  );
}
