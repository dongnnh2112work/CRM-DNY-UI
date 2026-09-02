"use client";

import { CalendarOutlined, CheckCircleOutlined, FileTextOutlined } from "@ant-design/icons";
import { App, Button, Col, Popconfirm, Row, type TableColumnsType } from "antd";
import { useCallback, useMemo, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { UrlQuerySync } from "@/components/shared/url-query-sync";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { VatInvoice, VatStatus } from "@/lib/types";
import { useT } from "@/lib/use-t";
import { resolveContractNumber } from "@/lib/vat-helpers";
import { useVat } from "@/lib/vat-store";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function VatPage() {
  const t = useT();
  const { message } = App.useApp();
  const { invoices, updateInvoice, deleteInvoices } = useVat();
  const { orders } = useOrders();
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const applyUrlQuery = useCallback((q: string) => {
    setQuery(q);
    setSelectedRowKeys([]);
  }, []);
  const [exporting, setExporting] = useState(false);

  const rows = useMemo(
    () =>
      invoices.map((v) => ({
        ...v,
        contractNumber: resolveContractNumber(v, orders),
      })),
    [invoices, orders],
  );

  const today = todayIso();
  const invoicesToday = rows.filter((v) => v.issueDate === today).length;
  const draftCount = rows.filter((v) => v.status === "draft").length;
  const issuedCount = rows.filter((v) => v.status === "issued").length;

  const filtered = rows.filter((v) =>
    matchesTableQuery(query, [
      v.contractNumber,
      v.customerName,
      v.orderNumber,
      v.taxCode,
      v.amount,
      v.taxRate,
      v.taxAmount,
      v.totalAmount,
      v.issueDate,
      v.status,
      getStatusMeta("vat", v.status).label,
      ...(v.lines ?? []).map((line) => line.description),
    ]),
  );

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const selectedInvoices = () => rows.filter((v) => selectedRowKeys.includes(v.id));

  const bulkExport = async () => {
    setExporting(true);
    try {
      const exportRows = selectedInvoices().map((v) => ({
        [t("common.contractNo")]: v.contractNumber ?? "",
        [t("common.customer")]: v.customerName,
        [t("common.order")]: v.orderNumber,
        [t("vat.goodsCol")]: v.amount,
        [t("vat.taxCol")]: v.taxAmount,
        [t("vat.totalCol")]: v.totalAmount,
        [t("vat.issueDate")]: v.issueDate,
        [t("common.status")]: v.status,
      }));
      await exportRowsToXlsx(`vat-selected-${Date.now()}.xlsx`, exportRows);
      message.success(t("vat.exported", { count: selectedCount }));
    } finally {
      setExporting(false);
    }
  };

  const bulkCancelDrafts = () => {
    const draftIds = selectedInvoices()
      .filter((v) => v.status === "draft")
      .map((v) => v.id);
    if (draftIds.length === 0) {
      message.warning(t("vat.noDrafts"));
      return;
    }
    for (const id of draftIds) updateInvoice(id, { status: "cancelled" });
    message.success(t("vat.cancelledN", { count: draftIds.length }));
    clearSelection();
  };

  const bulkDelete = () => {
    deleteInvoices(selectedRowKeys.map(String));
    message.success(t("vat.deletedN", { count: selectedCount }));
    clearSelection();
  };

  const draftSelectedCount = selectedInvoices().filter((v) => v.status === "draft").length;

  const columns: TableColumnsType<VatInvoice> = useMemo(
    () => [
      {
        title: t("common.contractNo"),
        dataIndex: "contractNumber",
        align: "center",
        sorter: (a, b) => (a.contractNumber ?? 0) - (b.contractNumber ?? 0),
        render: (v?: number) => (v != null ? v : "—"),
      },
      {
        title: t("common.customer"),
        dataIndex: "customerName",
        sorter: (a, b) => compareText(a.customerName, b.customerName),
      },
      {
        title: t("common.order"),
        dataIndex: "orderNumber",
        sorter: (a, b) => compareText(a.orderNumber, b.orderNumber),
      },
      {
        title: t("vat.goodsCol"),
        dataIndex: "amount",
        align: "center",
        sorter: (a, b) => a.amount - b.amount,
        render: (v: number) => formatVndDisplay(v),
      },
      {
        title: t("vat.taxCol"),
        dataIndex: "taxAmount",
        align: "center",
        sorter: (a, b) => a.taxAmount - b.taxAmount,
        render: (v: number) => formatVndDisplay(v),
      },
      {
        title: t("vat.totalCol"),
        dataIndex: "totalAmount",
        align: "center",
        sorter: (a, b) => a.totalAmount - b.totalAmount,
        render: (v: number) => formatVndDisplay(v),
      },
      {
        title: t("vat.issueDate"),
        dataIndex: "issueDate",
        sorter: (a, b) => compareText(a.issueDate, b.issueDate),
      },
      {
        title: t("common.status"),
        dataIndex: "status",
        sorter: (a, b) => compareText(a.status, b.status),
        render: (s: VatStatus) => <StatusBadge module="vat" status={s} />,
      },
    ],
    [t],
  );

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: t("nav.vat") }]}
        searchPlaceholder={t("common.searchTable")}
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: t("vat.newCta"), href: "/vat/new" }}
      />
      <div style={{ padding: "16px 16px 0" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <StatCard title={t("vat.today")} value={invoicesToday} prefix={<CalendarOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <StatCard title={t("vat.drafts")} value={draftCount} prefix={<FileTextOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <StatCard title={t("vat.issued")} value={issuedCount} prefix={<CheckCircleOutlined />} />
          </Col>
        </Row>
      </div>
      <DataTable<VatInvoice>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        loading={exporting}
        columnManagerKey="vat"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          query.trim() && invoices.length > 0 ? t("common.noResults") : t("vat.empty")
        }
        emptyAction={
          query.trim() && invoices.length > 0
            ? undefined
            : { label: t("common.createVat"), href: "/vat/new" }
        }
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Button size="small" onClick={bulkExport}>
              {t("common.exportExcel")}
            </Button>
            <Popconfirm
              title={t("vat.cancelN", { count: draftSelectedCount || selectedCount })}
              description={t("vat.cancelBody")}
              okText={t("vat.cancelOk")}
              cancelText={t("common.close")}
              onConfirm={bulkCancelDrafts}
            >
              <Button size="small">{t("vat.cancelDraftOnly")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("vat.deleteN", { count: selectedCount })}
              description={t("vat.deleteBody")}
              okText={t("common.delete")}
              cancelText={t("common.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={bulkDelete}
            >
              <Button size="small" danger>
                {t("common.delete")}
              </Button>
            </Popconfirm>
          </BulkActionBar>
        }
      />
    </>
  );
}
