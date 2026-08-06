"use client";

import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { App, Button, Select, Segmented, Table, Tag, type TableColumnsType } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { KanbanBoard } from "@/components/shared/kanban-board";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_USERS } from "@/lib/mock-users";
import { isTransitionAllowed, requiresApprovalForTransition, requiresLicenseForStage, canMoveToCompleted, getLicenseBlockMessage } from "@/lib/order-workflow";
import { useOrders } from "@/lib/orders-store";
import { APPROVAL_STATUS_LABELS, ORDER_STAGES, type Order, type OrderStage } from "@/lib/types";

export default function OrdersPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { orders, updateOrder } = useOrders();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...orders];
    if (userFilter !== "all") list = list.filter((o) => o.assignedUserId === userFilter);
    if (monthFilter !== "all") list = list.filter((o) => o.month === monthFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((o) =>
        [o.orderNumber, o.customerName, o.serviceName].some((f) => f.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [orders, userFilter, monthFilter, query]);

  const handleMove = (orderId: string, newStage: OrderStage) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;

    if (order.approvalStatus === "pending_review") {
      message.warning("Đơn đang chờ duyệt — mở chi tiết để Duyệt/Từ chối trước");
      return false;
    }

    if (requiresLicenseForStage(newStage) && !canMoveToCompleted(order)) {
      message.warning(getLicenseBlockMessage());
      return false;
    }

    if (requiresApprovalForTransition(order.stage, newStage) && !isTransitionAllowed(order, newStage)) {
      message.warning("Đổi giai đoạn cần duyệt. Mở đơn → Duyệt & Phê duyệt → Gửi duyệt");
      return false;
    }

    updateOrder(orderId, {
      stage: newStage,
      approvalStatus: "none",
      pendingTransition: undefined,
    });
    return true;
  };

  const months = [...new Set(orders.map((o) => o.month))].sort();

  const columns: TableColumnsType<Order> = [
    {
      title: "Mã đơn",
      dataIndex: "orderNumber",
      render: (v, r) => <Link href={`/orders/${r.id}`}>{v}</Link>,
    },
    { title: "Khách hàng", dataIndex: "customerName" },
    { title: "Dịch vụ", dataIndex: "serviceName" },
    {
      title: "Giai đoạn",
      dataIndex: "stage",
      render: (s: OrderStage) => {
        const st = ORDER_STAGES.find((x) => x.key === s);
        return <Tag color={st?.color}>{st?.label}</Tag>;
      },
    },
    {
      title: "Duyệt",
      dataIndex: "approvalStatus",
      render: (s: Order["approvalStatus"]) => {
        const color =
          s === "pending_review" ? "processing" : s === "approved" ? "success" : s === "rejected" ? "error" : "default";
        return <Tag color={color}>{APPROVAL_STATUS_LABELS[s]}</Tag>;
      },
    },
    { title: "Người duyệt", dataIndex: "reviewerName" },
    {
      title: "File",
      key: "files",
      render: (_, r) => r.attachments.filter((a) => !a.deleted).length,
    },
    {
      title: "Giá trị",
      dataIndex: "value",
      render: (v: number) => `${v.toLocaleString("vi-VN")} ₫`,
    },
    { title: "Phụ trách", dataIndex: "assignedUserName" },
    {
      title: "Thao tác",
      key: "action",
      render: (_, r) => (
        <Button size="small" onClick={() => router.push(`/orders/${r.id}`)}>
          Mở
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý đơn hàng" }]}
        searchPlaceholder="Tìm mã đơn, khách hàng, dịch vụ…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Tạo đơn", href: "/orders/new" }}
      >
        <Select
          value={userFilter}
          onChange={setUserFilter}
          style={{ width: 180 }}
          options={[
            { value: "all", label: "Tất cả nhân viên" },
            ...MOCK_USERS.filter((u) => u.role === "staff").map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
        <Select
          value={monthFilter}
          onChange={setMonthFilter}
          style={{ width: 140 }}
          options={[{ value: "all", label: "Tất cả tháng" }, ...months.map((m) => ({ value: m, label: m }))]}
        />
        <Segmented
          value={viewMode}
          onChange={(v) => setViewMode(v as "kanban" | "table")}
          options={[
            { value: "kanban", icon: <AppstoreOutlined /> },
            { value: "table", icon: <BarsOutlined /> },
          ]}
        />
      </PageHeader>
      {viewMode === "kanban" ? (
        <KanbanBoard orders={filtered} onMove={handleMove} />
      ) : (
        <div style={{ padding: 16 }}>
          <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} size="middle" />
        </div>
      )}
    </>
  );
}
