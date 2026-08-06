"use client";

import { Button, type TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DynamicTable } from "@/components/shared/dynamic-table";
import { PageHeader } from "@/components/shared/page-header";
import { SERVICE_LOCKED_FIELD_KEYS } from "@/lib/service-fields";
import { useServices } from "@/lib/services-store";
import type { Service } from "@/lib/types";

export default function ServicesPage() {
  const router = useRouter();
  const { services, fieldDefs, saveFieldDefs } = useServices();
  const [query, setQuery] = useState("");

  const filtered = services.filter((s) =>
    [s.name, s.code, s.category].some((f) => f.toLowerCase().includes(query.toLowerCase())),
  );

  const actionCol: TableColumnsType<Service> = [
    {
      title: "Thao tác",
      key: "action",
      fixed: "right" as const,
      width: 100,
      render: (_: unknown, record: Service) => (
        <Button size="small" onClick={() => router.push(`/services/${record.id}`)}>
          Mở
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Danh sách dịch vụ" }]}
        searchPlaceholder="Tìm tên, mã…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ Dịch vụ mới", href: "/services/new" }}
      />
      <DynamicTable<Service>
        fieldDefs={fieldDefs}
        onFieldDefsChange={saveFieldDefs}
        lockedFieldKeys={SERVICE_LOCKED_FIELD_KEYS}
        dataSource={filtered}
        rowKey="id"
        extra={actionCol}
      />
    </>
  );
}
