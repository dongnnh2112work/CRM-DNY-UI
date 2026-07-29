"use client";

import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Space, type TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DynamicTable } from "@/components/shared/dynamic-table";
import { ExcelImportModal } from "@/components/shared/excel-import-modal";
import { PageHeader } from "@/components/shared/page-header";
import { CUSTOMER_FIELD_DEFS, MOCK_CUSTOMERS } from "@/lib/mock-customers";
import type { Customer } from "@/lib/types";

export default function CustomersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [fieldDefs, setFieldDefs] = useState(CUSTOMER_FIELD_DEFS);
  const [customers, setCustomers] = useState(MOCK_CUSTOMERS);

  const filtered = customers.filter((c) =>
    [c.name, c.phone, c.email, c.company ?? ""].some((f) => f.toLowerCase().includes(query.toLowerCase())),
  );

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
        searchPlaceholder="Tìm tên, SĐT, email…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Khách hàng mới", href: "/customers/new" }}
      >
        <Space>
          <Button icon={<UploadOutlined />} onClick={() => setImportOpen(true)}>
            Nhập Excel
          </Button>
          <Button icon={<DownloadOutlined />}>Xuất</Button>
        </Space>
      </PageHeader>
      <DynamicTable<Customer>
        fieldDefs={fieldDefs}
        onFieldDefsChange={setFieldDefs}
        dataSource={filtered}
        rowKey="id"
        extra={actionCol}
        onRow={(record) => ({ onClick: () => router.push(`/customers/${record.id}`) })}
      />
      <ExcelImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        expectedColumns={["Name", "Phone", "Email", "Company", "Tax Code"]}
        onImport={(rows) => {
          const newCustomers = rows.map((r, i) => ({
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
          setCustomers((prev) => [...prev, ...newCustomers]);
        }}
      />
    </>
  );
}
