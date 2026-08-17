"use client";

import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { App, Button, Modal, Popconfirm, Select, Space } from "antd";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type Key } from "react";
import { UsedServiceTags } from "@/components/customers/used-service-tags";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DynamicTable } from "@/components/shared/dynamic-table";
import { ExcelImportModal } from "@/components/shared/excel-import-modal";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusSelect } from "@/components/shared/status-select";
import { useCustomerStatusConfig } from "@/lib/customer-status-store";
import {
  CUSTOMER_OWNER_OPTIONS,
  getCustomerUsedServices,
  usedServiceNames,
} from "@/lib/customer-helpers";
import { CUSTOMER_LOCKED_FIELD_KEYS, useCustomers } from "@/lib/customers-store";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";
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
  const { orders } = useOrders();
  const { services } = useServices();
  const { getMeta, statusOptions, addStatus, updateStatus, removeStatus } = useCustomerStatusConfig();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignOwner, setAssignOwner] = useState<string>();

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) setQuery(q);
  }, [searchParams]);

  const usedByCustomer = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getCustomerUsedServices>>();
    for (const c of customers) {
      map.set(c.id, getCustomerUsedServices(c.id, c.usedServiceIds, orders, services));
    }
    return map;
  }, [customers, orders, services]);

  const filtered = useMemo(() => {
    let list = [...customers];
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    if (ownerFilter !== "all") list = list.filter((c) => c.owner === ownerFilter);
    if (query.trim()) {
      list = list.filter((c) =>
        matchesTableQuery(query, [
          c.name,
          c.phone,
          c.email,
          c.company,
          c.taxCode,
          c.address,
          c.owner,
          c.status,
          getMeta(c.status).label,
          c.createdAt,
          c.customFields,
          usedServiceNames(usedByCustomer.get(c.id) ?? []),
        ]),
      );
    }
    return list;
  }, [customers, statusFilter, ownerFilter, query, usedByCustomer, getMeta]);

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);
  const hasActiveFilters =
    Boolean(query.trim()) || statusFilter !== "all" || ownerFilter !== "all";

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

  const toExportRow = (c: Customer) => ({
    Name: c.name,
    Phone: c.phone,
    Email: c.email,
    Company: c.company ?? "",
    "Tax Code": c.taxCode ?? "",
    Status: c.status,
    Owner: c.owner,
    "Dịch vụ đã dùng": usedServiceNames(usedByCustomer.get(c.id) ?? []).join(", "),
  });

  const bulkExport = async () => {
    const rows = selectedCustomers().map(toExportRow);
    await exportRowsToXlsx(`customers-selected-${Date.now()}.xlsx`, rows);
    message.success(`Đã xuất ${selectedCount} khách hàng`);
  };

  const exportAllVisible = async () => {
    const rows = filtered.map(toExportRow);
    await exportRowsToXlsx(`customers-${Date.now()}.xlsx`, rows);
    message.success(`Đã xuất ${rows.length} khách hàng`);
  };

  const bulkAssign = () => {
    if (!assignOwner) {
      message.warning("Chọn nhân viên phụ trách");
      return;
    }
    selectedRowKeys.forEach((id) => updateCustomer(String(id), { owner: assignOwner }));
    message.success(`Đã gán ${selectedCount} khách hàng cho ${assignOwner}`);
    setAssignOpen(false);
    setAssignOwner(undefined);
    clearSelection();
  };

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
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            clearSelection();
          }}
          style={{ width: 160 }}
          options={[
            { value: "all", label: "Tất cả trạng thái" },
            ...statusOptions,
          ]}
        />
        <Select
          value={ownerFilter}
          onChange={(v) => {
            setOwnerFilter(v);
            clearSelection();
          }}
          style={{ width: 180 }}
          options={[{ value: "all", label: "Tất cả phụ trách" }, ...CUSTOMER_OWNER_OPTIONS]}
        />
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
        statusModule="customer"
        linkField={{ key: "name", onClick: (record) => router.push(`/customers/${record.id}`) }}
        columnOverrides={{
          status: {
            render: (value, record) => (
              <StatusSelect
                module="customer"
                value={String(value)}
                options={statusOptions}
                onChange={(v) => {
                  if (v === record.status) return;
                  updateCustomer(record.id, { status: v });
                  message.success("Đã cập nhật trạng thái");
                }}
                manage={{
                  takenColors: statusOptions.map((s) => s.color),
                  onColorChange: (key, hex) => updateStatus(key, { color: hex }),
                  onAdd: (label) => addStatus(label),
                  onRemove: (key) => {
                    const inUse = customers.filter((c) => c.status === key).length;
                    if (inUse > 0) {
                      return {
                        ok: false,
                        reason: `Không thể xóa — còn ${inUse} khách hàng dùng trạng thái này`,
                      };
                    }
                    return removeStatus(key);
                  },
                }}
              />
            ),
          },
          usedServiceIds: {
            width: 260,
            sorter: (a, b) =>
              (usedByCustomer.get(a.id)?.length ?? 0) - (usedByCustomer.get(b.id)?.length ?? 0),
            render: (_value, record) => (
              <UsedServiceTags services={usedByCustomer.get(record.id) ?? []} />
            ),
          },
        }}
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
            <Button size="small" onClick={() => setAssignOpen(true)}>
              Gán phụ trách
            </Button>
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
          hasActiveFilters && customers.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có khách hàng nào."
        }
        emptyAction={
          hasActiveFilters && customers.length > 0
            ? undefined
            : { label: "Tạo khách hàng", href: "/customers/new" }
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
            usedServiceIds: [],
            customFields: {},
          }));
          addCustomers(newCustomers);
        }}
      />
      <Modal
        title={`Gán phụ trách cho ${selectedCount} khách hàng`}
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={bulkAssign}
        okText="Gán"
        cancelText="Hủy"
      >
        <Select
          style={{ width: "100%" }}
          placeholder="Chọn nhân viên"
          value={assignOwner}
          onChange={setAssignOwner}
          options={CUSTOMER_OWNER_OPTIONS}
        />
      </Modal>
    </>
  );
}
