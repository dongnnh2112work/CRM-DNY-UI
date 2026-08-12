"use client";

import { AppstoreOutlined, BarsOutlined } from "@ant-design/icons";
import { App, Button, Modal, Select, Segmented, Tag, type TableColumnsType } from "antd";
import Link from "next/link";
import { useMemo, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanBoard } from "@/components/shared/kanban-board";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { formatVndDisplay } from "@/lib/format-vnd";
import { MOCK_USERS } from "@/lib/mock-users";
import {
  canMoveToCompleted,
  getLicenseBlockMessage,
  requiresLicenseForStage,
} from "@/lib/order-workflow";
import { useAppReminderConfig } from "@/lib/app-config-store";
import {
  getOrderLicenseExpirySummary,
  licenseExpiryTagColor,
} from "@/lib/order-helpers";
import { useOrders } from "@/lib/orders-store";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { Order, OrderStage } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function OrdersPage() {
  const { message } = App.useApp();
  const { orders, updateOrder } = useOrders();
  const { config } = useAppReminderConfig();
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>();
  const [exporting, setExporting] = useState(false);

  const staffUsers = MOCK_USERS.filter((u) => u.role === "staff" || u.role === "admin");

  const filtered = useMemo(() => {
    let list = [...orders];
    if (userFilter !== "all") list = list.filter((o) => o.assignedUserId === userFilter);
    if (monthFilter !== "all") list = list.filter((o) => o.month === monthFilter);
    if (query.trim()) {
      list = list.filter((o) =>
        matchesTableQuery(query, [
          o.orderNumber,
          o.customerName,
          o.serviceName,
          o.stage,
          getStatusMeta("orderStage", o.stage).label,
          o.approvalStatus,
          getStatusMeta("approval", o.approvalStatus).label,
          o.reviewerName,
          o.assignedUserName,
          o.submitterName,
          o.ctvName,
          o.channel,
          o.month,
          o.value,
          o.ctvPrice,
          o.needsVat ? "VAT" : "",
          o.contractNumber,
          o.deadline,
          o.vatIssueDeadline,
          o.attachments.filter((a) => !a.deleted).length,
          o.licenseAttachments?.filter((a) => !a.deleted).length,
        ]),
      );
    }
    return list;
  }, [orders, userFilter, monthFilter, query]);

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const handleMove = (orderId: string, newStage: OrderStage) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;

    if (requiresLicenseForStage(newStage) && !canMoveToCompleted(order)) {
      message.warning(getLicenseBlockMessage());
      return false;
    }

    updateOrder(orderId, {
      stage: newStage,
      approvalStatus: "none",
      pendingTransition: undefined,
    });
    return true;
  };

  const bulkExport = async () => {
    setExporting(true);
    try {
      const rows = orders
        .filter((o) => selectedRowKeys.includes(o.id))
        .map((o) => ({
          "Mã đơn": o.orderNumber,
          "Khách hàng": o.customerName,
          "Dịch vụ": o.serviceName,
          "Giai đoạn": o.stage,
          "Giá trị": o.value,
          "Phụ trách": o.assignedUserName,
        }));
      await exportRowsToXlsx(`orders-selected-${Date.now()}.xlsx`, rows);
      message.success(`Đã xuất ${selectedCount} đơn hàng`);
    } finally {
      setExporting(false);
    }
  };

  const bulkAssign = () => {
    const user = staffUsers.find((u) => u.id === assignUserId);
    if (!user) {
      message.warning("Chọn nhân viên phụ trách");
      return;
    }
    selectedRowKeys.forEach((id) =>
      updateOrder(String(id), {
        assignedUserId: user.id,
        assignedUserName: user.name,
      }),
    );
    message.success(`Đã gán ${selectedCount} đơn cho ${user.name}`);
    setAssignOpen(false);
    setAssignUserId(undefined);
    clearSelection();
  };

  const months = [...new Set(orders.map((o) => o.month))].sort();
  const hasActiveFilters = Boolean(query.trim()) || userFilter !== "all" || monthFilter !== "all";
  const listEmptyDescription =
    hasActiveFilters && orders.length > 0
      ? "Không tìm thấy kết quả phù hợp."
      : "Chưa có đơn hàng nào.";
  const listEmptyAction =
    hasActiveFilters && orders.length > 0
      ? undefined
      : { label: "Tạo đơn hàng", href: "/orders/new" };

  const columns: TableColumnsType<Order> = [
    {
      title: "Mã đơn",
      dataIndex: "orderNumber",
      sorter: (a, b) => compareText(a.orderNumber, b.orderNumber),
      render: (v, r) => <Link href={`/orders/${r.id}`}>{v}</Link>,
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      sorter: (a, b) => compareText(a.customerName, b.customerName),
    },
    {
      title: "Dịch vụ",
      dataIndex: "serviceName",
      sorter: (a, b) => compareText(a.serviceName, b.serviceName),
    },
    {
      title: "Giai đoạn",
      dataIndex: "stage",
      sorter: (a, b) => compareText(a.stage, b.stage),
      render: (s: OrderStage) => <StatusBadge module="orderStage" status={s} />,
    },
    {
      title: "Số HĐ",
      dataIndex: "contractNumber",
      align: "center",
      sorter: (a, b) => (a.contractNumber ?? 0) - (b.contractNumber ?? 0),
      render: (v?: number) => (v != null ? v : "—"),
    },
    {
      title: "Xuất VAT",
      dataIndex: "needsVat",
      filters: [
        { text: "Có VAT", value: true },
        { text: "Không VAT", value: false },
      ],
      onFilter: (value, record) => record.needsVat === value,
      render: (v: boolean) => (
        <Tag color={v ? "blue" : "default"}>{v ? "Có VAT" : "Không VAT"}</Tag>
      ),
    },
    {
      title: "Thời hạn GP",
      key: "licenseExpiry",
      render: (_, r) => {
        const s = getOrderLicenseExpirySummary(r, config.licenseExpiryWarnMonths);
        return <Tag color={licenseExpiryTagColor(s.tone)}>{s.label}</Tag>;
      },
    },
    {
      title: "File",
      key: "files",
      align: "center",
      sorter: (a, b) =>
        a.attachments.filter((x) => !x.deleted).length - b.attachments.filter((x) => !x.deleted).length,
      render: (_, r) => r.attachments.filter((a) => !a.deleted).length,
    },
    {
      title: "Giá trị",
      dataIndex: "value",
      align: "center",
      sorter: (a, b) => a.value - b.value,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Phụ trách",
      dataIndex: "assignedUserName",
      sorter: (a, b) => compareText(a.assignedUserName, b.assignedUserName),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý đơn hàng" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ Tạo đơn", href: "/orders/new" }}
      >
        <Select
          value={userFilter}
          onChange={(v) => {
            setUserFilter(v);
            clearSelection();
          }}
          style={{ width: 180 }}
          options={[
            { value: "all", label: "Tất cả nhân viên" },
            ...MOCK_USERS.filter((u) => u.role === "staff").map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
        <Select
          value={monthFilter}
          onChange={(v) => {
            setMonthFilter(v);
            clearSelection();
          }}
          style={{ width: 140 }}
          options={[{ value: "all", label: "Tất cả tháng" }, ...months.map((m) => ({ value: m, label: m }))]}
        />
        <Segmented
          value={viewMode}
          onChange={(v) => {
            setViewMode(v as "kanban" | "table");
            clearSelection();
          }}
          options={[
            { value: "kanban", icon: <AppstoreOutlined /> },
            { value: "table", icon: <BarsOutlined /> },
          ]}
        />
      </PageHeader>
      {filtered.length === 0 ? (
        <EmptyState description={listEmptyDescription} action={listEmptyAction} />
      ) : viewMode === "kanban" ? (
        <KanbanBoard orders={filtered} onMove={handleMove} />
      ) : (
        <DataTable<Order>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={exporting}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          emptyDescription="Chưa có đơn hàng nào."
          emptyAction={{ label: "Tạo đơn hàng", href: "/orders/new" }}
          bulkToolbar={
            <BulkActionBar count={selectedCount}>
              <Button size="small" onClick={bulkExport}>
                Xuất Excel
              </Button>
              <Button size="small" onClick={() => setAssignOpen(true)}>
                Gán phụ trách
              </Button>
            </BulkActionBar>
          }
        />
      )}

      <Modal
        title={`Gán phụ trách cho ${selectedCount} đơn`}
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={bulkAssign}
        okText="Gán"
        cancelText="Hủy"
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Chọn nhân viên"
          value={assignUserId}
          onChange={setAssignUserId}
          options={staffUsers.map((u) => ({ value: u.id, label: u.name }))}
        />
      </Modal>
    </>
  );
}
