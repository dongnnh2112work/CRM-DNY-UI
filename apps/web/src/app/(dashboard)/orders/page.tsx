"use client";

import { AppstoreOutlined, BarsOutlined, BgColorsOutlined } from "@ant-design/icons";
import { App, Button, Modal, Select, Segmented, Tag, type TableColumnsType } from "antd";
import Link from "next/link";
import { useCallback, useMemo, useState, type Key } from "react";
import { CashflowAmounts } from "@/components/orders/cashflow-amounts";
import { OrderStageSettingsDrawer } from "@/components/orders/order-stage-settings-drawer";
import { ZaloGroupLink } from "@/components/orders/zalo-group-link";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { KanbanBoard } from "@/components/shared/kanban-board";
import { PageHeader } from "@/components/shared/page-header";
import { StatusSelect } from "@/components/shared/status-select";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { useRemoteList } from "@/components/api-hydrator";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { formatVndDisplay } from "@/lib/format-vnd";
import { taskAssignedDraft } from "@/lib/notification-targets";
import { useNotifications } from "@/lib/notifications-store";
import {
  getOrderLicenseExpirySummary,
  licenseExpiryTagColor,
  licenseWarnMonthsForOrder,
} from "@/lib/order-helpers";
import {
  buildOrderCashflow,
  cashflowForMonth,
  currentYearMonth,
  formatYearMonth,
  type OrderCashflow,
} from "@/lib/order-cashflow";
import { useOrders } from "@/lib/orders-store";
import { apiErrorMessage } from "@/lib/http/message";
import { ordersApi } from "@/modules/orders/api";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import { useExpenses } from "@/lib/expenses-store";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { Order, OrderStage } from "@/lib/types";
import { useUsers } from "@/lib/users-store";
import { useServices } from "@/lib/services-store";
import { useT } from "@/lib/use-t";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

const emptyFlow: OrderCashflow = { thu: 0, chi: 0, net: 0, months: [] };

export default function OrdersPage() {
  const t = useT();
  const { message, modal } = App.useApp();
  const { orders, updateOrder } = useOrders();
  const { payments } = usePayments();
  const { expenses } = useExpenses();
  const { services } = useServices();
  const { addNotifications } = useNotifications();
  const { getMeta, stageOptions } = useOrderStatusConfig();
  const { currentUser, getEffectivePermissions, users } = useUsers();
  const ordersRemote = useRemoteList("orders");
  const perms = currentUser ? getEffectivePermissions(currentUser) : null;
  const canViewStages = Boolean(perms?.order_statuses?.view);
  const canEditStages = Boolean(perms?.order_statuses?.edit);
  const [viewMode, setViewMode] = useState<"kanban" | "table">("kanban");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>();
  const [exporting, setExporting] = useState(false);
  const [stageDrawerOpen, setStageDrawerOpen] = useState(false);

  const staffUsers = users.filter((u) => u.status === "active");
  const cashflowMonth = monthFilter === "all" ? currentYearMonth() : monthFilter;

  const cashflowByOrder = useMemo(() => {
    const expensesByOrder = new Map<string, typeof expenses>();
    for (const e of expenses) {
      if (!e.orderId) continue;
      const list = expensesByOrder.get(e.orderId) ?? [];
      list.push(e);
      expensesByOrder.set(e.orderId, list);
    }
    const paymentByOrder = new Map(payments.map((p) => [p.orderId, p]));
    const map = new Map<string, OrderCashflow>();
    for (const o of orders) {
      map.set(o.id, buildOrderCashflow(paymentByOrder.get(o.id), expensesByOrder.get(o.id) ?? []));
    }
    return map;
  }, [orders, payments, expenses]);

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
          getMeta("orderStage", o.stage).label,
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
          o.zaloGroupUrl,
          o.commissionPercent,
          cashflowByOrder.get(o.id)?.thu,
          cashflowByOrder.get(o.id)?.chi,
          o.attachments.filter((a) => !a.deleted).length,
          o.licenseAttachments?.filter((a) => !a.deleted).length,
        ]),
      );
    }
    return list;
  }, [orders, userFilter, monthFilter, query, getMeta, cashflowByOrder]);

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const handleMove = async (orderId: string, newStage: OrderStage) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return false;
    try {
      await ordersApi.changeStage(orderId, newStage);
      updateOrder(orderId, {
        stage: newStage,
        approvalStatus: "none",
        pendingTransition: undefined,
      });
      return true;
    } catch (err) {
      message.error(apiErrorMessage(err, t("order.stageUpdated")));
      return false;
    }
  };

  const requestStageChange = (order: Order, newStage: OrderStage) => {
    if (newStage === order.stage) return;
    const nextLabel = getMeta("orderStage", newStage).label;
    modal.confirm({
      title: t("order.changeStage", { label: nextLabel }),
      content: `${order.orderNumber} · ${order.customerName}`,
      okText: t("common.confirm"),
      cancelText: t("common.cancel"),
      onOk: async () => {
        const ok = await handleMove(order.id, newStage);
        if (ok) message.success(t("order.stageUpdated"));
      },
    });
  };

  const bulkExport = async () => {
    setExporting(true);
    try {
      const rows = orders
        .filter((o) => selectedRowKeys.includes(o.id))
        .map((o) => ({
          [t("common.dossier")]: o.orderNumber,
          [t("common.customer")]: o.customerName,
          [t("common.service")]: o.serviceName,
          [t("common.stage")]: o.stage,
          [t("common.value")]: o.value,
          [t("common.owner")]: o.assignedUserName,
          [t("order.thuForMonth", { label: formatYearMonth(cashflowMonth) })]: cashflowForMonth(
            cashflowByOrder.get(o.id) ?? emptyFlow,
            cashflowMonth,
          ).thu,
          [t("order.chiForMonth", { label: formatYearMonth(cashflowMonth) })]: cashflowForMonth(
            cashflowByOrder.get(o.id) ?? emptyFlow,
            cashflowMonth,
          ).chi,
          [t("order.thuTotal")]: cashflowByOrder.get(o.id)?.thu ?? 0,
          [t("order.chiTotal")]: cashflowByOrder.get(o.id)?.chi ?? 0,
        }));
      await exportRowsToXlsx(`orders-selected-${Date.now()}.xlsx`, rows);
      message.success(t("order.exported", { count: selectedCount }));
    } finally {
      setExporting(false);
    }
  };

  const bulkAssign = async () => {
    const user = staffUsers.find((u) => u.id === assignUserId);
    if (!user) {
      message.warning(t("common.selectStaffOwner"));
      return;
    }
    try {
      await Promise.all(
        selectedRowKeys.map(async (id) => {
          const orderId = String(id);
          const order = orders.find((o) => o.id === orderId);
          await ordersApi.assign(orderId, user.id);
          updateOrder(orderId, {
            assignedUserId: user.id,
            assignedUserName: user.name,
          });
          if (order && order.assignedUserId !== user.id) {
            addNotifications(
              [user.id],
              taskAssignedDraft({
                id: order.id,
                orderNumber: order.orderNumber,
                customerName: order.customerName,
                serviceName: order.serviceName,
              }),
              currentUser?.id,
            );
          }
        }),
      );
      message.success(t("order.assigned", { count: selectedCount, name: user.name }));
      setAssignOpen(false);
      setAssignUserId(undefined);
      clearSelection();
    } catch (err) {
      message.error(apiErrorMessage(err, t("common.assign")));
    }
  };

  const months = [...new Set(orders.map((o) => o.month))].sort();
  const hasActiveFilters = Boolean(query.trim()) || userFilter !== "all" || monthFilter !== "all";
  const listEmptyDescription =
    hasActiveFilters && orders.length > 0 ? t("common.noResults") : t("order.empty");
  const listEmptyAction =
    hasActiveFilters && orders.length > 0
      ? undefined
      : { label: t("common.createOrder"), href: "/orders/new" };

  const columns: TableColumnsType<Order> = useMemo(
    () => [
    {
      title: t("common.dossier"),
      dataIndex: "orderNumber",
      sorter: (a, b) => compareText(a.orderNumber, b.orderNumber),
      render: (v, r) => <Link href={`/orders/${r.id}`}>{v}</Link>,
    },
    {
      title: t("common.customer"),
      dataIndex: "customerName",
      sorter: (a, b) => compareText(a.customerName, b.customerName),
    },
    {
      title: t("common.service"),
      dataIndex: "serviceName",
      sorter: (a, b) => compareText(a.serviceName, b.serviceName),
    },
    {
      title: "Zalo",
      dataIndex: "zaloGroupUrl",
      width: 80,
      render: (url?: string) => <ZaloGroupLink url={url} variant="tag" />,
    },
    {
      title: t("common.stage"),
      dataIndex: "stage",
      sorter: (a, b) => compareText(a.stage, b.stage),
      render: (s: OrderStage, r) => (
        <StatusSelect
          module="orderStage"
          value={s}
          options={stageOptions.map((opt) => ({ value: opt.value, label: opt.label }))}
          onChange={(v) => requestStageChange(r, v as OrderStage)}
        />
      ),
    },
    {
      title: t("common.contractNo"),
      dataIndex: "contractNumber",
      align: "center",
      sorter: (a, b) => (a.contractNumber ?? 0) - (b.contractNumber ?? 0),
      render: (v?: number) => (v != null ? v : "—"),
    },
    {
      title: t("order.issueVat"),
      dataIndex: "needsVat",
      filters: [
        { text: t("common.withVat"), value: true },
        { text: t("common.withoutVat"), value: false },
      ],
      onFilter: (value, record) => record.needsVat === value,
      render: (v: boolean) => (
        <Tag color={v ? "blue" : "default"}>{v ? t("common.withVat") : t("common.withoutVat")}</Tag>
      ),
    },
    {
      title: t("license.expiry"),
      key: "licenseExpiry",
      filters: [
        { text: t("license.expired"), value: "expired" },
        { text: t("license.expiring"), value: "expiring" },
        { text: t("license.ok"), value: "ok" },
        { text: t("license.none"), value: "none" },
      ],
      filterMultiple: true,
      onFilter: (value, record) =>
        getOrderLicenseExpirySummary(record, licenseWarnMonthsForOrder(record, services)).tone ===
        value,
      render: (_, r) => {
        const s = getOrderLicenseExpirySummary(r, licenseWarnMonthsForOrder(r, services));
        return <Tag color={licenseExpiryTagColor(s.tone)}>{s.label}</Tag>;
      },
    },
    {
      title: t("common.file"),
      key: "files",
      align: "center",
      sorter: (a, b) =>
        a.attachments.filter((x) => !x.deleted).length - b.attachments.filter((x) => !x.deleted).length,
      render: (_, r) => r.attachments.filter((a) => !a.deleted).length,
    },
    {
      title: t("common.value"),
      dataIndex: "value",
      align: "center",
      sorter: (a, b) => a.value - b.value,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: t("order.cashflowMonthCol", { label: formatYearMonth(cashflowMonth) }),
      key: "cashflowMonth",
      align: "right",
      sorter: (a, b) =>
        cashflowForMonth(cashflowByOrder.get(a.id) ?? emptyFlow, cashflowMonth).thu -
        cashflowForMonth(cashflowByOrder.get(b.id) ?? emptyFlow, cashflowMonth).thu,
      render: (_, r) => {
        const m = cashflowForMonth(cashflowByOrder.get(r.id) ?? emptyFlow, cashflowMonth);
        return <CashflowAmounts thu={m.thu} chi={m.chi} />;
      },
    },
    {
      title: t("order.cashflowCol"),
      key: "cashflowTotal",
      align: "right",
      sorter: (a, b) => (cashflowByOrder.get(a.id)?.thu ?? 0) - (cashflowByOrder.get(b.id)?.thu ?? 0),
      render: (_, r) => {
        const f = cashflowByOrder.get(r.id) ?? emptyFlow;
        return <CashflowAmounts thu={f.thu} chi={f.chi} />;
      },
    },
    {
      title: t("common.owner"),
      dataIndex: "assignedUserName",
      sorter: (a, b) => compareText(a.assignedUserName, b.assignedUserName),
    },
  ],
    [t, stageOptions, requestStageChange, cashflowByOrder, cashflowMonth, services],
  );

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.orders") }]}
        searchPlaceholder={t("common.searchTable")}
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: t("order.newCta"), href: "/orders/new" }}
      >
        <Select
          value={userFilter}
          onChange={(v) => {
            setUserFilter(v);
            clearSelection();
          }}
          style={{ width: 180 }}
          options={[
            { value: "all", label: t("common.allStaff") },
            ...staffUsers
              .filter((u) => u.role === "staff" || u.role === "admin")
              .map((u) => ({ value: u.id, label: u.name })),
          ]}
        />
        <Select
          value={monthFilter}
          onChange={(v) => {
            setMonthFilter(v);
            clearSelection();
          }}
          style={{ width: 140 }}
          options={[{ value: "all", label: t("common.allMonths") }, ...months.map((m) => ({ value: m, label: m }))]}
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
        {canViewStages ? (
          <Button icon={<BgColorsOutlined />} onClick={() => setStageDrawerOpen(true)}>
            {t("nav.orderStatuses")}
          </Button>
        ) : null}
      </PageHeader>
      {viewMode === "kanban" ? (
        filtered.length === 0 ? (
          <EmptyState description={listEmptyDescription} action={listEmptyAction} />
        ) : (
          <KanbanBoard orders={filtered} onMove={handleMove} />
        )
      ) : (
        <DataTable<Order>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={exporting}
          columnManagerKey="orders"
          remote={ordersRemote}
          enableRowSelection
          selectedRowKeys={selectedRowKeys}
          onSelectedRowKeysChange={setSelectedRowKeys}
          emptyDescription={listEmptyDescription}
          emptyAction={listEmptyAction}
          bulkToolbar={
            <BulkActionBar count={selectedCount}>
              <Button size="small" onClick={bulkExport}>
                {t("common.exportExcel")}
              </Button>
              <Button size="small" onClick={() => setAssignOpen(true)}>
                {t("common.assign")}
              </Button>
            </BulkActionBar>
          }
        />
      )}

      <Modal
        title={t("order.assignTitle", { count: selectedCount })}
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={bulkAssign}
        okText={t("common.assign")}
        cancelText={t("common.cancel")}
      >
        <Select
          style={{ width: "100%" }}
          placeholder={t("common.selectStaff")}
          value={assignUserId}
          onChange={setAssignUserId}
          options={staffUsers.map((u) => ({ value: u.id, label: u.name }))}
        />
      </Modal>

      <OrderStageSettingsDrawer
        open={stageDrawerOpen}
        onClose={() => setStageDrawerOpen(false)}
        canEdit={canEditStages}
      />
    </>
  );
}
