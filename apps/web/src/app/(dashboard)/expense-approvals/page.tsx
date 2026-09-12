"use client";

import { App, Button, Popconfirm, Select, Space, Tag, type TableColumnsType } from "antd";
import Link from "next/link";
import { useCallback, useMemo, useState, type Key } from "react";
import { PaymentRequestDrawer } from "@/components/orders/payment-request-drawer";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { formatVndDisplay } from "@/lib/format-vnd";
import { expenseReviewedDraft } from "@/lib/notification-targets";
import { expenseProjectLabel, useExpenses } from "@/lib/expenses-store";
import { PERMISSION, expenseReviewBlock } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { isInDateRange, type DateRangeValue } from "@/lib/date-range";
import { matchesTableQuery } from "@/lib/table-search";
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";
import { useUsers } from "@/lib/users-store";
import { apiErrorMessage } from "@/lib/http/message";
import { expensesApi } from "@/modules/expenses/api";
import { useT } from "@/lib/use-t";
import { useRemoteList } from "@/components/api-hydrator";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function ExpenseApprovalsPage() {
  const t = useT();
  const { message } = App.useApp();
  const { currentUser } = useUsers();
  const { can } = useSession();
  const { expenses, reviewExpense } = useExpenses();
  const { addNotifications } = useNotifications();
  const { getById: getOrder } = useOrders();
  const expensesRemote = useRemoteList("expenses");
  const [statusFilter, setStatusFilter] = useState<OrderExpenseStatus | "all">("pending");
  const [query, setQuery] = useState("");
  const [dateRange, setDateRange] = useState<DateRangeValue>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);

  const canView = can(PERMISSION.expenseView);
  const canApproveApi = can(PERMISSION.expenseApprove);
  const canCreateExpense = can(PERMISSION.expenseCreate);

  const filtered = useMemo(() => {
    let list = [...expenses];
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
    if (dateRange?.[0] || dateRange?.[1]) {
      list = list.filter((e) => isInDateRange(e.requestedAt, dateRange));
    }
    if (query.trim()) {
      list = list.filter((e) =>
        matchesTableQuery(query, [
          e.orderNumber,
          expenseProjectLabel(e),
          e.title,
          e.amount,
          e.status,
          e.requestedByName,
          e.requestedAt,
          e.payeeName,
          e.bankAccount,
          e.bankName,
          e.note,
          e.reviewedByName,
        ]),
      );
    }
    return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [expenses, statusFilter, dateRange, query]);

  const selectedSum = useMemo(() => {
    const ids = new Set(selectedRowKeys.map(String));
    return filtered.filter((e) => ids.has(e.id)).reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filtered, selectedRowKeys]);

  const columns: TableColumnsType<OrderExpense> = useMemo(
    () => [
      {
        title: t("common.project"),
        key: "project",
        sorter: (a, b) => compareText(expenseProjectLabel(a), expenseProjectLabel(b)),
        render: (_, r) => {
          const label = expenseProjectLabel(r);
          return r.orderId ? <Link href={`/orders/${r.orderId}`}>{label}</Link> : label;
        },
      },
      { title: t("common.content"), dataIndex: "title", ellipsis: true },
      {
        title: t("common.amount"),
        dataIndex: "amount",
        align: "center",
        sorter: (a, b) => a.amount - b.amount,
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
      { title: t("expense.requestedAt"), dataIndex: "requestedAt" },
      {
        title: t("common.actions"),
        key: "actions",
        render: (_, r) => {
          if (r.status !== "pending") {
            return r.reviewedByName ? (
              <Tag>
                {r.status === "approved"
                  ? t("expense.approvedBy", { name: r.reviewedByName })
                  : t("expense.rejectedBy", { name: r.reviewedByName })}
              </Tag>
            ) : (
              "—"
            );
          }
          if (!currentUser) return <Tag>{t("common.viewOnly")}</Tag>;
          const order = r.orderId ? getOrder(r.orderId) : undefined;
          const block = expenseReviewBlock({
            hasExpenseApprovePermission: canApproveApi,
            currentUserId: currentUser.id,
            reviewerId: order?.reviewerId,
          });
          if (block !== "ok") {
            return (
              <Tag>
                {block === "no_permission"
                  ? t("expense.needApprovePerm")
                  : block === "no_reviewer"
                    ? t("expense.noReviewerOnOrder")
                    : t("expense.onlyReviewer")}
              </Tag>
            );
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
                      [r.requestedById, r.orderId ? getOrder(r.orderId)?.reviewerId : undefined],
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
                      [r.requestedById, r.orderId ? getOrder(r.orderId)?.reviewerId : undefined],
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
    [t, canApproveApi, currentUser, reviewExpense, addNotifications, getOrder, message],
  );

  if (!currentUser || !canView) {
    return (
      <EmptyState
        description={t("expense.forbidden")}
        action={{ label: t("nav.users"), href: "/users" }}
      />
    );
  }

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.expenses") }]}
        searchPlaceholder={t("expense.search")}
        onSearch={(v) => {
          setQuery(v);
          setSelectedRowKeys([]);
        }}
        searchValue={query}
        dateRange={dateRange}
        onDateRangeChange={(v) => {
          setDateRange(v);
          setSelectedRowKeys([]);
        }}
        primaryAction={
          canCreateExpense ? { label: t("expense.newCta"), onClick: () => setCreateOpen(true) } : undefined
        }
      >
        <Select
          value={statusFilter}
          style={{ width: 160 }}
          onChange={(v) => {
            setStatusFilter(v);
            setSelectedRowKeys([]);
          }}
          options={[
            { value: "pending", label: t("status.approval.pending_review") },
            { value: "approved", label: t("common.approved") },
            { value: "rejected", label: t("common.reject") },
            { value: "all", label: t("common.all") },
          ]}
        />
      </PageHeader>
      <DataTable<OrderExpense>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="expense-approvals"
        remote={expensesRemote}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        bulkToolbar={
          <BulkActionBar
            count={selectedRowKeys.length}
            summary={t("expense.selectedSum", { amount: formatVndDisplay(selectedSum) })}
          />
        }
        emptyDescription={
          query.trim() && expenses.length > 0
            ? t("common.noResults")
            : statusFilter === "pending"
              ? t("expense.emptyPending")
              : t("expense.empty")
        }
        emptyAction={
          query.trim() && expenses.length > 0
            ? undefined
            : canCreateExpense
              ? { label: t("expense.create"), onClick: () => setCreateOpen(true) }
              : undefined
        }
      />
      <PaymentRequestDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
