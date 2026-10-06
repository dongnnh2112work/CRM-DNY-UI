"use client";

import {
  App,
  Button,
  DatePicker,
  Grid,
  Input,
  Popconfirm,
  Skeleton,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PaymentRequestDrawer } from "@/components/orders/payment-request-drawer";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { isInDateRange, type DateRangeValue } from "@/lib/date-range";
import { ds } from "@/lib/design-tokens";
import { lookupUserName, resolveEntityLookups } from "@/lib/entity-lookups";
import { useExpenses } from "@/lib/expenses-store";
import { rangePickerFormat } from "@/lib/format-date";
import { formatVndDisplay } from "@/lib/format-vnd";
import { apiErrorMessage } from "@/lib/http/message";
import { expenseReviewedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import { buildOrderCashflow, formatYearMonth } from "@/lib/order-cashflow";
import { allocatePaymentShare, siblingOrders } from "@/lib/order-group";
import { entityDisplayName, hasHydratedName } from "@/lib/order-helpers";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { PERMISSION, expenseReviewBlock } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { matchesTableQuery } from "@/lib/table-search";
import type { Order, OrderExpense } from "@/lib/types";
import { useUsers } from "@/lib/users-store";
import { expensesApi } from "@/modules/expenses/api";
import { EXPENSE_VOID_NOTE } from "@/modules/expenses/map-to-ui";
import { useT } from "@/lib/use-t";

function personLabel(name?: string | null, id?: string | null) {
  return entityDisplayName(lookupUserName(id), name);
}

function StatBlock({
  label,
  value,
  color,
  ready,
}: {
  label: string;
  value: number;
  color?: string;
  ready: boolean;
}) {
  return (
    <div
      style={{
        flex: "1 1 140px",
        minWidth: 0,
        padding: "10px 12px",
        borderRadius: ds.radius.md,
        background: ds.canvasSoft,
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption, display: "block" }}>
        {label}
      </Typography.Text>
      <div style={{ fontWeight: 600, color, minHeight: 24, marginTop: 2, wordBreak: "break-word" }}>
        {ready ? formatVndDisplay(value) : <Skeleton.Input active size="small" style={{ width: 96 }} />}
      </div>
    </div>
  );
}

export function OrderExpensesPanel({
  order,
  financeReady = true,
}: {
  order: Order;
  financeReady?: boolean;
}) {
  const t = useT();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  /** Only switch to cards after we know viewport is below md (avoids SSR flash). */
  const isCompact = screens.md === false;
  const { currentUser } = useUsers();
  const { can, user } = useSession();
  const { getByOrderId } = usePayments();
  const { orders } = useOrders();
  const { getByOrderId: getExpenses, reviewExpense } = useExpenses();
  const { addNotifications } = useNotifications();
  const [addOpen, setAddOpen] = useState(false);
  const [nameTick, setNameTick] = useState(0);
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobileDateRange, setMobileDateRange] = useState<DateRangeValue>(null);

  const siblings = siblingOrders(orders, order);
  const groupPay = getByOrderId(order.id);
  const payment = allocatePaymentShare(groupPay, order, siblings);
  const rows = getExpenses(order.id);
  const flow = useMemo(() => buildOrderCashflow(payment, rows), [payment, rows]);
  const canApproveApi = can(PERMISSION.expenseApprove);
  const reviewBlock = expenseReviewBlock({
    hasExpenseApprovePermission: canApproveApi,
  });
  const canReview = reviewBlock === "ok";

  useEffect(() => {
    const userIds = rows.flatMap((r) => {
      const ids: string[] = [];
      if (r.requestedById && !hasHydratedName(r.requestedByName)) ids.push(r.requestedById);
      if (r.reviewedById && !hasHydratedName(r.reviewedByName)) ids.push(r.reviewedById);
      return ids;
    });
    if (!userIds.length) return;
    void resolveEntityLookups({ userIds }, user?.permissions).then(() => setNameTick((n) => n + 1));
  }, [rows, user?.permissions]);

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
        responsive: ["sm"] as ("sm")[],
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

  const runApprove = async (r: OrderExpense) => {
    if (!currentUser) return;
    try {
      await expensesApi.approve(r.id);
      reviewExpense(r.id, "approved", { id: currentUser.id, name: currentUser.name });
      addNotifications(
        [r.requestedById],
        expenseReviewedDraft(r, "approved", currentUser.name),
        currentUser.id,
      );
      message.success(t("expense.approved"));
    } catch (err) {
      message.error(apiErrorMessage(err, t("expense.approved")));
    }
  };

  const runReject = async (r: OrderExpense) => {
    if (!currentUser) return;
    try {
      await expensesApi.reject(r.id);
      reviewExpense(r.id, "rejected", { id: currentUser.id, name: currentUser.name });
      addNotifications(
        [r.requestedById],
        expenseReviewedDraft(r, "rejected", currentUser.name),
        currentUser.id,
      );
      message.success(t("expense.rejected"));
    } catch (err) {
      message.error(apiErrorMessage(err, t("expense.rejected")));
    }
  };

  const runVoid = async (r: OrderExpense) => {
    if (!currentUser) return;
    try {
      if (!r.id.startsWith("ex-")) await expensesApi.reject(r.id, EXPENSE_VOID_NOTE);
      reviewExpense(r.id, "cancelled", { id: currentUser.id, name: currentUser.name }, EXPENSE_VOID_NOTE);
      message.success(t("expense.voided"));
    } catch (err) {
      message.error(apiErrorMessage(err, t("expense.voided")));
    }
  };

  const renderActions = (r: OrderExpense): ReactNode => {
    if (r.status !== "pending") {
      if (r.status === "cancelled" && r.reviewedByName) {
        return (
          <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
            {t("expense.voidedBy", { name: personLabel(r.reviewedByName, r.reviewedById) })}
          </Typography.Text>
        );
      }
      return personLabel(r.reviewedByName, r.reviewedById);
    }
    if (!currentUser) return <Tag>{t("expense.needApprovePerm")}</Tag>;
    const canVoid = canReview || r.requestedById === currentUser.id;

    const btnStyle = isCompact ? { flex: "1 1 96px" } : undefined;

    const voidAction = canVoid ? (
      <Popconfirm
        title={t("expense.voidTitle")}
        description={t("expense.voidBody")}
        okText={t("expense.void")}
        cancelText={t("common.cancel")}
        onConfirm={() => void runVoid(r)}
      >
        <Button size="small" style={btnStyle}>
          {t("expense.void")}
        </Button>
      </Popconfirm>
    ) : null;

    if (!canReview) {
      return voidAction ?? <Tag>{t("expense.needApprovePerm")}</Tag>;
    }

    return (
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 4,
          width: isCompact ? "100%" : undefined,
          justifyContent: isCompact ? "stretch" : "flex-start",
        }}
      >
        <Popconfirm
          title={t("expense.approveTitle")}
          okText={t("common.approve")}
          cancelText={t("common.cancel")}
          onConfirm={() => void runApprove(r)}
        >
          <Button size="small" type="primary" style={btnStyle}>
            {t("common.approve")}
          </Button>
        </Popconfirm>
        <Popconfirm
          title={t("expense.rejectTitle")}
          okText={t("common.reject")}
          cancelText={t("common.cancel")}
          okButtonProps={{ danger: true }}
          onConfirm={() => void runReject(r)}
        >
          <Button size="small" danger style={btnStyle}>
            {t("common.reject")}
          </Button>
        </Popconfirm>
        {voidAction}
      </div>
    );
  };

  const expenseColumns = useMemo(
    () => [
      {
        title: t("common.content"),
        dataIndex: "title",
        ellipsis: true,
        width: 160,
      },
      {
        title: t("common.amount"),
        dataIndex: "amount",
        align: "right" as const,
        width: 120,
        render: (v: number) => formatVndDisplay(v),
      },
      {
        title: t("common.payee"),
        dataIndex: "payeeName",
        ellipsis: true,
        width: 140,
        responsive: ["lg"] as ("lg")[],
        render: (v?: string) => v || "—",
      },
      {
        title: t("expense.accountNo"),
        dataIndex: "bankAccount",
        width: 130,
        ellipsis: true,
        responsive: ["xl"] as ("xl")[],
        render: (v?: string) => v || "—",
      },
      {
        title: t("common.bank"),
        dataIndex: "bankName",
        ellipsis: true,
        width: 120,
        responsive: ["xl"] as ("xl")[],
        render: (v?: string) => v || "—",
      },
      {
        title: t("common.status"),
        dataIndex: "status",
        width: 100,
        render: (s: string) => <StatusBadge module="approvalRequest" status={s} />,
      },
      {
        title: t("common.requester"),
        dataIndex: "requestedByName",
        width: 120,
        ellipsis: true,
        responsive: ["md"] as ("md")[],
        render: (_: string, r: OrderExpense) => personLabel(r.requestedByName, r.requestedById),
      },
      {
        title: t("common.date"),
        dataIndex: "requestedAt",
        width: 110,
        responsive: ["md"] as ("md")[],
      },
      {
        title: t("common.actions"),
        key: "actions",
        fixed: "right" as const,
        width: 220,
        render: (_: unknown, r: OrderExpense) => renderActions(r),
      },
    ],
    // nameTick refreshes labels after resolveEntityLookups fills the cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, canReview, currentUser, isCompact, nameTick, addNotifications, message, reviewExpense],
  );

  const mobileRows = useMemo(() => {
    let list = rows;
    if (mobileDateRange?.[0] || mobileDateRange?.[1]) {
      list = list.filter((e) => isInDateRange(e.requestedAt, mobileDateRange));
    }
    if (mobileQuery.trim()) {
      list = list.filter((e) =>
        matchesTableQuery(mobileQuery, [
          e.title,
          e.amount,
          e.status,
          personLabel(e.requestedByName, e.requestedById),
          e.requestedAt,
          e.payeeName,
          e.bankAccount,
          e.bankName,
          e.note,
        ]),
      );
    }
    return list;
  }, [rows, mobileDateRange, mobileQuery, nameTick]);

  return (
    <div style={{ minWidth: 0 }}>
      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: "0 0 8px" }}>
        {t("order.wholeOrder")}
      </Typography.Title>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 24,
        }}
      >
        <StatBlock label={t("order.totalThu")} value={flow.thu} color={ds.accentGreen} ready={financeReady} />
        <StatBlock
          label={t("order.totalChiApproved")}
          value={flow.chi}
          color={ds.danger}
          ready={financeReady}
        />
        <StatBlock label={t("order.diff")} value={flow.net} ready={financeReady} />
      </div>

      <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: "0 0 8px" }}>
        {t("order.byMonth")}
      </Typography.Title>
      <div style={{ marginBottom: 24, maxWidth: isCompact ? "100%" : 560, minWidth: 0 }}>
        {financeReady ? (
          <DataTable
            rowKey="month"
            size="small"
            pagination={false}
            padded={false}
            dateFilterField="month"
            datePicker="month"
            enableLocalSearch
            scroll={{ x: true }}
            dataSource={flow.months}
            emptyDescription={t("order.cashflowEmpty")}
            columns={monthColumns}
          />
        ) : (
          <Skeleton active paragraph={{ rows: 3 }} title={false} />
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Typography.Title level={5} style={{ fontSize: ds.fontSize.body, margin: 0 }}>
          {t("nav.expenses")}
        </Typography.Title>
        {can(PERMISSION.expenseCreate) ? (
          <Button
            type="primary"
            onClick={() => setAddOpen(true)}
            style={isCompact ? { width: "100%" } : undefined}
          >
            {t("expense.newCta")}
          </Button>
        ) : null}
      </div>
      <PaymentRequestDrawer open={addOpen} onClose={() => setAddOpen(false)} lockedOrder={order} />

      {isCompact ? (
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Input.Search
              allowClear
              placeholder={t("common.search")}
              value={mobileQuery}
              onChange={(e) => setMobileQuery(e.target.value)}
              style={{ width: "100%" }}
            />
            <DatePicker.RangePicker
              allowEmpty={[true, true]}
              value={mobileDateRange}
              onChange={(next) => setMobileDateRange(next)}
              format={rangePickerFormat("date")}
              placeholder={[t("common.dateFrom"), t("common.dateTo")]}
              style={{ width: "100%" }}
            />
          </div>
          {!mobileRows.length ? (
            <Typography.Text type="secondary">{t("expense.empty")}</Typography.Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mobileRows.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: `1px solid ${ds.hairline}`,
                    borderRadius: ds.radius.md,
                    padding: 12,
                    opacity: r.status === "cancelled" ? 0.45 : 1,
                    background: ds.surface,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <Typography.Text strong style={{ flex: 1, minWidth: 0 }}>
                      {r.title || "—"}
                    </Typography.Text>
                    <StatusBadge module="approvalRequest" status={r.status} />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px 12px",
                      fontSize: ds.fontSize.bodySm,
                      marginBottom: 10,
                    }}
                  >
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                        {t("common.amount")}
                      </Typography.Text>
                      <div style={{ fontWeight: 600 }}>{formatVndDisplay(r.amount)}</div>
                    </div>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                        {t("common.date")}
                      </Typography.Text>
                      <div>{r.requestedAt || "—"}</div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                        {t("common.payee")}
                      </Typography.Text>
                      <div style={{ wordBreak: "break-word" }}>{r.payeeName || "—"}</div>
                    </div>
                    {(r.bankAccount || r.bankName) && (
                      <div style={{ gridColumn: "1 / -1" }}>
                        <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                          {t("common.bank")}
                        </Typography.Text>
                        <div style={{ wordBreak: "break-word" }}>
                          {[r.bankAccount, r.bankName].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    )}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.caption }}>
                        {t("common.requester")}
                      </Typography.Text>
                      <div>{personLabel(r.requestedByName, r.requestedById)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>{renderActions(r)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <DataTable<OrderExpense>
          rowKey="id"
          size="small"
          pagination={false}
          padded={false}
          scroll={{ x: 720 }}
          dataSource={rows}
          dateFilterField="requestedAt"
          enableLocalSearch
          emptyDescription={t("expense.empty")}
          columns={expenseColumns}
          onRow={(row) => (row.status === "cancelled" ? { style: { opacity: 0.45 } } : {})}
        />
      )}
    </div>
  );
}
