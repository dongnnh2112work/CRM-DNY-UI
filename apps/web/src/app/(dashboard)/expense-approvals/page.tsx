"use client";

import { App, Button, Popconfirm, Select, Space, Tag, type TableColumnsType } from "antd";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { formatVndDisplay } from "@/lib/format-vnd";
import { expenseReviewedDraft } from "@/lib/notification-targets";
import { useExpenses } from "@/lib/expenses-store";
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
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
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
          e.title,
          e.amount,
          e.status,
          e.requestedByName,
          e.requestedAt,
          e.note,
          e.reviewedByName,
        ]),
      );
    }
    return list.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [expenses, statusFilter, query]);

  if (!currentUser || !canView) {
    return (
      <EmptyState
        description="Bạn không có quyền xem Duyệt chi. Bật Xem trên trang Duyệt chi trong phân quyền vai trò."
        action={{ label: "Quản lý người dùng", href: "/users" }}
      />
    );
  }

  const columns: TableColumnsType<OrderExpense> = [
    {
      title: "Đơn hàng",
      dataIndex: "orderNumber",
      sorter: (a, b) => compareText(a.orderNumber, b.orderNumber),
      render: (v, r) => <Link href={`/orders/${r.orderId}`}>{v}</Link>,
    },
    { title: "Nội dung", dataIndex: "title" },
    {
      title: "Số tiền",
      dataIndex: "amount",
      align: "center",
      sorter: (a, b) => a.amount - b.amount,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (s: string) => <StatusBadge module="approvalRequest" status={s} />,
    },
    { title: "Người yêu cầu", dataIndex: "requestedByName" },
    { title: "Ngày gửi", dataIndex: "requestedAt" },
    {
      title: "Ghi chú",
      dataIndex: "note",
      ellipsis: true,
      render: (v?: string) => v || "—",
    },
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
              title="Duyệt khoản chi này?"
              okText="Duyệt"
              cancelText="Hủy"
              onConfirm={() => {
                reviewExpense(r.id, "approved", {
                  id: currentUser.id,
                  name: currentUser.name,
                });
                addNotifications(
                  [r.requestedById, getOrder(r.orderId)?.reviewerId],
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
                  [r.requestedById, getOrder(r.orderId)?.reviewerId],
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
        breadcrumbs={[{ title: "Duyệt chi" }]}
        searchPlaceholder="Tìm khoản chi…"
        onSearch={setQuery}
        searchValue={query}
      >
        <Select
          value={statusFilter}
          style={{ width: 160 }}
          onChange={(v) => setStatusFilter(v)}
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
        emptyDescription={
          query.trim() && expenses.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : statusFilter === "pending"
              ? "Không có yêu cầu duyệt chi đang chờ."
              : "Chưa có khoản chi."
        }
      />
    </>
  );
}
