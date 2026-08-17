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
import { resolveContractNumber } from "@/lib/vat-helpers";
import { useVat } from "@/lib/vat-store";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function VatPage() {
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
        "Số HĐ": v.contractNumber ?? "",
        "Khách hàng": v.customerName,
        "Đơn hàng": v.orderNumber,
        "Tiền hàng": v.amount,
        Thuế: v.taxAmount,
        Tổng: v.totalAmount,
        "Ngày xuất": v.issueDate,
        "Trạng thái": v.status,
      }));
      await exportRowsToXlsx(`vat-selected-${Date.now()}.xlsx`, exportRows);
      message.success(`Đã xuất ${selectedCount} hóa đơn VAT`);
    } finally {
      setExporting(false);
    }
  };

  const bulkCancelDrafts = () => {
    const draftIds = selectedInvoices()
      .filter((v) => v.status === "draft")
      .map((v) => v.id);
    if (draftIds.length === 0) {
      message.warning("Không có hóa đơn nháp trong các dòng đã chọn.");
      return;
    }
    for (const id of draftIds) updateInvoice(id, { status: "cancelled" });
    message.success(`Đã hủy ${draftIds.length} hóa đơn nháp`);
    clearSelection();
  };

  const bulkDelete = () => {
    deleteInvoices(selectedRowKeys.map(String));
    message.success(`Đã xóa ${selectedCount} hóa đơn VAT`);
    clearSelection();
  };

  const draftSelectedCount = selectedInvoices().filter((v) => v.status === "draft").length;

  const columns: TableColumnsType<VatInvoice> = [
    {
      title: "Số HĐ",
      dataIndex: "contractNumber",
      align: "center",
      sorter: (a, b) => (a.contractNumber ?? 0) - (b.contractNumber ?? 0),
      render: (v?: number) => (v != null ? v : "—"),
    },
    {
      title: "Khách hàng",
      dataIndex: "customerName",
      sorter: (a, b) => compareText(a.customerName, b.customerName),
    },
    {
      title: "Đơn hàng",
      dataIndex: "orderNumber",
      sorter: (a, b) => compareText(a.orderNumber, b.orderNumber),
    },
    {
      title: "Tiền hàng",
      dataIndex: "amount",
      align: "center",
      sorter: (a, b) => a.amount - b.amount,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Thuế",
      dataIndex: "taxAmount",
      align: "center",
      sorter: (a, b) => a.taxAmount - b.taxAmount,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Tổng",
      dataIndex: "totalAmount",
      align: "center",
      sorter: (a, b) => a.totalAmount - b.totalAmount,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Ngày xuất",
      dataIndex: "issueDate",
      sorter: (a, b) => compareText(a.issueDate, b.issueDate),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sorter: (a, b) => compareText(a.status, b.status),
      render: (s: VatStatus) => <StatusBadge module="vat" status={s} />,
    },
  ];

  return (
    <>
      <UrlQuerySync onQuery={applyUrlQuery} />
      <PageHeader
        breadcrumbs={[{ title: "Quản lý VAT" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ Hóa đơn VAT mới", href: "/vat/new" }}
      />
      <div style={{ padding: "16px 16px 0" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={8}>
            <StatCard title="Hóa đơn trong ngày" value={invoicesToday} prefix={<CalendarOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <StatCard title="Hóa đơn nháp" value={draftCount} prefix={<FileTextOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <StatCard title="Hóa đơn đã xuất" value={issuedCount} prefix={<CheckCircleOutlined />} />
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
          query.trim() && invoices.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có hóa đơn VAT nào."
        }
        emptyAction={
          query.trim() && invoices.length > 0
            ? undefined
            : { label: "Tạo hóa đơn VAT", href: "/vat/new" }
        }
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Button size="small" onClick={bulkExport}>
              Xuất Excel
            </Button>
            <Popconfirm
              title={`Hủy ${draftSelectedCount || selectedCount} hóa đơn nháp đã chọn?`}
              description="Chỉ các bản ghi trạng thái Nháp (draft) sẽ chuyển sang Đã hủy. Bản ghi khác được bỏ qua."
              okText="Hủy hóa đơn"
              cancelText="Đóng"
              onConfirm={bulkCancelDrafts}
            >
              <Button size="small">Hủy (chỉ nháp)</Button>
            </Popconfirm>
            <Popconfirm
              title={`Xóa ${selectedCount} hóa đơn VAT đã chọn?`}
              description="Áp dụng mọi trạng thái. Chỉ các dòng đang chọn trên trang hiện tại."
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              onConfirm={bulkDelete}
            >
              <Button size="small" danger>
                Xóa
              </Button>
            </Popconfirm>
          </BulkActionBar>
        }
      />
    </>
  );
}
