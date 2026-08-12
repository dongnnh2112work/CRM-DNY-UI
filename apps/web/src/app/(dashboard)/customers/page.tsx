"use client";

import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Popconfirm, Space, type TableColumnsType } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DynamicTable } from "@/components/shared/dynamic-table";
import { ExcelImportModal } from "@/components/shared/excel-import-modal";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { CUSTOMER_LOCKED_FIELD_KEYS, useCustomers } from "@/lib/customers-store";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { Customer, CustomerStatus } from "@/lib/types";

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { customers, fieldDefs, saveFieldDefs, addCustomers, updateCustomer, deleteCustomer } =
    useCustomers();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) setQuery(q);
  }, [searchParams]);

  const filtered = customers.filter((c) =>
    matchesTableQuery(query, [
      c.name,
      c.phone,
      c.email,
      c.company,
      c.taxCode,
      c.address,
      c.owner,
      c.status,
      getStatusMeta("customer", c.status).label,
      c.createdAt,
      c.customFields,
    ]),
  );

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const selectedCustomers = () =>
    customers.filter((c) => selectedRowKeys.includes(c.id));

  const bulkSetStatus = (status: CustomerStatus) => {
    selectedRowKeys.forEach((id) => updateCustomer(String(id), { status }));
    message.success(`Đã cập nhật trạng thái ${selectedCount} khách hàng`);
    clearSelection();
  };

  const bulkDelete = () => {
    selectedRowKeys.forEach((id) => deleteCustomer(String(id)));
    message.success(`Đã xóa ${selectedCount} khách hàng`);
    clearSelection();
  };

  const bulkExport = async () => {
    const rows = selectedCustomers().map((c) => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email,
      Company: c.company ?? "",
      "Tax Code": c.taxCode ?? "",
      Status: c.status,
      Owner: c.owner,
    }));
    await exportRowsToXlsx(`customers-selected-${Date.now()}.xlsx`, rows);
    message.success(`Đã xuất ${selectedCount} khách hàng`);
  };

  const exportAllVisible = async () => {
    const rows = filtered.map((c) => ({
      Name: c.name,
      Phone: c.phone,
      Email: c.email,
      Company: c.company ?? "",
      "Tax Code": c.taxCode ?? "",
      Status: c.status,
      Owner: c.owner,
    }));
    await exportRowsToXlsx(`customers-${Date.now()}.xlsx`, rows);
    message.success(`Đã xuất ${rows.length} khách hàng`);
  };

  const actionCol: TableColumnsType<Customer> = [
    {
      title: "Thao tác",
      key: "action",
      fixed: "right" as const,
      width: 100,
      render: (_: unknown, record: Customer) => (
        <Button size="small" onClick={() => router.push(`/customers/${record.id}`)}>
          Mở
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý khách hàng" }]}
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ Khách hàng mới", href: "/customers/new" }}
      >
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Nhập Excel
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportAllVisible}>
            Xuất
          </Button>
        </Space>
      </PageHeader>
      <DynamicTable<Customer>
        fieldDefs={fieldDefs}
        onFieldDefsChange={saveFieldDefs}
        lockedFieldKeys={CUSTOMER_LOCKED_FIELD_KEYS}
        dataSource={filtered}
        rowKey="id"
        extra={actionCol}
        statusModule="customer"
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Popconfirm
              title={`Đặt ${selectedCount} khách hàng thành Hoạt động?`}
              okText="Xác nhận"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("active")}
            >
              <Button size="small">Hoạt động</Button>
            </Popconfirm>
            <Popconfirm
              title={`Đặt ${selectedCount} khách hàng thành Tiềm năng?`}
              okText="Xác nhận"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("lead")}
            >
              <Button size="small">Tiềm năng</Button>
            </Popconfirm>
            <Popconfirm
              title={`Lưu trữ ${selectedCount} khách hàng đã chọn?`}
              okText="Lưu trữ"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("archived")}
            >
              <Button size="small">Lưu trữ</Button>
            </Popconfirm>
            <Button size="small" onClick={bulkExport}>
              Xuất Excel
            </Button>
            <Popconfirm
              title={`Xóa ${selectedCount} khách hàng đã chọn?`}
              description="Chỉ áp dụng các dòng đang chọn trên trang hiện tại."
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
        emptyDescription={
          query.trim() && customers.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có khách hàng nào."
        }
        emptyAction={
          query.trim() && customers.length > 0
            ? undefined
            : { label: "Thêm khách hàng", href: "/customers/new" }
        }
        onRow={(record) => ({ onClick: () => router.push(`/customers/${record.id}`) })}
      />
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        expectedColumns={["Name", "Phone", "Email", "Company", "Tax Code"]}
        onImport={(rows) => {
          const newCustomers: Customer[] = rows.map((r, i) => ({
            id: `imported-${Date.now()}-${i}`,
            name: String(r.Name ?? r.name ?? ""),
            phone: String(r.Phone ?? r.phone ?? ""),
            email: String(r.Email ?? r.email ?? ""),
            company: String(r.Company ?? r.company ?? ""),
            taxCode: String(r["Tax Code"] ?? r.taxCode ?? ""),
            owner: "Le Staff A",
            status: "lead" as const,
            createdAt: new Date().toISOString().slice(0, 10),
            customFields: {},
          }));
          addCustomers(newCustomers);
        }}
      />
    </>
  );
}
