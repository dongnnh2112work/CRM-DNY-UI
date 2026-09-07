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
  getCustomerUsedServices,
  usedServiceNames,
} from "@/lib/customer-helpers";
import { CUSTOMER_LOCKED_FIELD_KEYS, useCustomers } from "@/lib/customers-store";
import { exportRowsToXlsx } from "@/lib/export-xlsx";
import { apiErrorMessage } from "@/lib/http/message";
import { useOrders } from "@/lib/orders-store";
import { useSession } from "@/lib/session/session-provider";
import { useServices } from "@/lib/services-store";
import { matchesTableQuery } from "@/lib/table-search";
import type { Customer, CustomerStatus } from "@/lib/types";
import { useUsers } from "@/lib/users-store";
import { customersApi } from "@/modules/customers/api";
import { useT } from "@/lib/use-t";

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CustomersPageContent />
    </Suspense>
  );
}

function CustomersPageContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const { can } = useSession();
  const { customers, fieldDefs, saveFieldDefs, updateCustomer, deleteCustomer, addCustomers } = useCustomers();
  const { users } = useUsers();
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
  const ownerOptions = useMemo(
    () => users.filter((u) => u.status === "active").map((u) => ({ value: u.id, label: u.name })),
    [users],
  );

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
    message.success(t("customer.statusUpdatedN", { count: selectedCount }));
    clearSelection();
  };

  const bulkDelete = async () => {
    try {
      await Promise.all(selectedRowKeys.map((id) => customersApi.remove(String(id))));
      selectedRowKeys.forEach((id) => deleteCustomer(String(id)));
      message.success(t("customer.deletedN", { count: selectedCount }));
      clearSelection();
    } catch (err) {
      message.error(apiErrorMessage(err, t("customer.loadFailed")));
    }
  };

  const toExportRow = (c: Customer) => ({
    [t("common.name")]: c.name,
    [t("common.phone")]: c.phone,
    [t("common.email")]: c.email,
    [t("common.company")]: c.company ?? "",
    [t("common.taxCode")]: c.taxCode ?? "",
    [t("common.status")]: c.status,
    [t("common.owner")]: c.owner,
    [t("customer.usedServices")]: usedServiceNames(usedByCustomer.get(c.id) ?? []).join(", "),
  });

  const bulkExport = async () => {
    const rows = selectedCustomers().map(toExportRow);
    await exportRowsToXlsx(`customers-selected-${Date.now()}.xlsx`, rows);
    message.success(t("customer.exported", { count: selectedCount }));
  };

  const exportAllVisible = async () => {
    const rows = filtered.map(toExportRow);
    await exportRowsToXlsx(`customers-${Date.now()}.xlsx`, rows);
    message.success(t("customer.exported", { count: rows.length }));
  };

  const bulkAssign = async () => {
    if (!assignOwner) {
      message.warning(t("common.selectStaffOwner"));
      return;
    }
    try {
      await Promise.all(
        selectedRowKeys.map((id) => customersApi.update(String(id), { ownerId: assignOwner })),
      );
      selectedRowKeys.forEach((id) => updateCustomer(String(id), { owner: assignOwner }));
      message.success(t("customer.assigned", { count: selectedCount, name: assignOwner }));
      setAssignOpen(false);
      setAssignOwner(undefined);
      clearSelection();
    } catch (err) {
      message.error(apiErrorMessage(err, t("customer.loadFailed")));
    }
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: t("nav.customers") }]}
        searchPlaceholder={t("common.searchTable")}
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={
          can("customer.create") ? { label: t("customer.newCta"), href: "/customers/new" } : undefined
        }
      >
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            clearSelection();
          }}
          style={{ width: 160 }}
          options={[
            { value: "all", label: t("common.allStatuses") },
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
          options={[{ value: "all", label: t("customer.allOwners") }, ...ownerOptions]}
        />
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            {t("common.importExcel")}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportAllVisible}>
            {t("common.export")}
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
                  message.success(t("customer.statusUpdated"));
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
                        reason: t("common.cannotDeleteInUse", { count: inUse }),
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
              title={t("customer.setActiveN", { count: selectedCount })}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("active")}
            >
              <Button size="small">{t("status.customer.active")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("customer.setLeadN", { count: selectedCount })}
              okText={t("common.confirm")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("lead")}
            >
              <Button size="small">{t("status.customer.lead")}</Button>
            </Popconfirm>
            <Popconfirm
              title={t("customer.archiveN", { count: selectedCount })}
              okText={t("customer.archiveOk")}
              cancelText={t("common.cancel")}
              onConfirm={() => bulkSetStatus("archived")}
            >
              <Button size="small">{t("customer.archiveOk")}</Button>
            </Popconfirm>
            <Button size="small" onClick={() => setAssignOpen(true)}>
              {t("common.assign")}
            </Button>
            <Button size="small" onClick={bulkExport}>
              {t("common.exportExcel")}
            </Button>
            <Popconfirm
              title={t("customer.deleteN", { count: selectedCount })}
              description={t("common.applyCurrentPage")}
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
        emptyDescription={
          hasActiveFilters && customers.length > 0 ? t("common.noResults") : t("customer.empty")
        }
        emptyAction={
          hasActiveFilters && customers.length > 0
            ? undefined
            : can("customer.create")
              ? { label: t("common.createCustomer"), href: "/customers/new" }
              : undefined
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
        title={t("customer.assignTitle", { count: selectedCount })}
        open={assignOpen}
        onCancel={() => setAssignOpen(false)}
        onOk={bulkAssign}
        okText={t("common.assign")}
        cancelText={t("common.cancel")}
      >
        <Select
          style={{ width: "100%" }}
          placeholder={t("common.selectStaff")}
          value={assignOwner}
          onChange={setAssignOwner}
          options={ownerOptions}
        />
      </Modal>
    </>
  );
}
