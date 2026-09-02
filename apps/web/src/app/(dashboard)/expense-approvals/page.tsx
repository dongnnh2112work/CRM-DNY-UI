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
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { matchesTableQuery } from "@/lib/table-search";
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";
import { useUsers } from "@/lib/users-store";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function ExpenseApprovalsPage() {
  const { message } = App.useApp();
  const { currentUser, getEffectivePermissions } = useUsers();
  const { expenses, reviewExpense } = useExpenses();
  const { addNotifications } = useNotifications();
  const { getById: getOrder } = useOrders();
  const [statusFilter, setStatusFilter] = useState<OrderExpenseStatus | "all">("pending");
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);

  const perms = currentUser ? getEffectivePermissions(currentUser) : null;
  const canView = Boolean(perms?.expense_approvals?.view);
  const canApprove = Boolean(perms?.expense_approvals?.edit);

  const filtered = useMemo(() => {
    let list = [...expenses];
    if (statusFilter !== "all") list = list.filter((e) => e.status === statusFilter);
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
  }, [expenses, statusFilter, query]);

  const selectedSum = useMemo(() => {
    const ids = new Set(selectedRowKeys.map(String));
    return filtered.filter((e) => ids.has(e.id)).reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filtered, selectedRowKeys]);

  if (!currentUser || !canView) {
    return (
      <EmptyState
        description="Bạn không có quyền xem Đề nghị thanh toán. Bật Xem trên trang Đề nghị thanh toán trong phân quyền vai trò."
        action={{ label: "Quản lý người dùng", href: "/users" }}
      />
    );
  }

  const columns: TableColumnsType<OrderExpense> = [
    {
      title: "Dự án",
      key: "project",
      sorter: (a, b) => compareText(expenseProjectLabel(a), expenseProjectLabel(b)),
      render: (_, r) => {
        const label = expenseProjectLabel(r);
        return r.orderId ? <Link href={`/orders/${r.orderId}`}>{label}</Link> : label;
      },
    },
    { title: "Nội dung", dataIndex: "title", ellipsis: true },
    {
      title: "Số tiền",
      dataIndex: "amount",
      align: "center",
      sorter: (a, b) => a.amount - b.amount,
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
    { title: "Ngày gửi", dataIndex: "requestedAt" },
    {
      title: "Thao tác",
      key: "actions",
      render: (_, r) => {
        if (r.status !== "pending") {
          return r.reviewedByName ? (
            <Tag>
              {r.status === "approved" ? "Duyệt bởi" : "Từ chối bởi"} {r.reviewedByName}
            </Tag>
          ) : (
            "—"
          );
        }
        if (!canApprove) return <Tag>Chỉ xem</Tag>;
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
                  [r.requestedById, r.orderId ? getOrder(r.orderId)?.reviewerId : undefined],
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
                  [r.requestedById, r.orderId ? getOrder(r.orderId)?.reviewerId : undefined],
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
  ];

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: "Đề nghị thanh toán" }]}
        searchPlaceholder="Tìm đề nghị thanh toán…"
        onSearch={(v) => {
          setQuery(v);
          setSelectedRowKeys([]);
        }}
        searchValue={query}
        primaryAction={{ label: "+ Tạo đề nghị thanh toán", onClick: () => setCreateOpen(true) }}
      >
        <Select
          value={statusFilter}
          style={{ width: 160 }}
          onChange={(v) => {
            setStatusFilter(v);
            setSelectedRowKeys([]);
          }}
          options={[
            { value: "pending", label: "Chờ duyệt" },
            { value: "approved", label: "Đã duyệt" },
            { value: "rejected", label: "Từ chối" },
            { value: "all", label: "Tất cả" },
          ]}
        />
      </PageHeader>
      <DataTable<OrderExpense>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        columnManagerKey="expense-approvals"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        bulkToolbar={
          <BulkActionBar
            count={selectedRowKeys.length}
            summary={`Tổng đã chọn: ${formatVndDisplay(selectedSum)}`}
          />
        }
        emptyDescription={
          query.trim() && expenses.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : statusFilter === "pending"
              ? "Không có đề nghị đang chờ duyệt."
              : "Chưa có đề nghị thanh toán."
        }
        emptyAction={
          query.trim() && expenses.length > 0
            ? undefined
            : { label: "Tạo đề nghị thanh toán", onClick: () => setCreateOpen(true) }
        }
      />
      <PaymentRequestDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
