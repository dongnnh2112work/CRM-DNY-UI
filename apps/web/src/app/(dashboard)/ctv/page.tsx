"use client";

import { Button, Table, Tag, type TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useCtvs } from "@/lib/ctvs-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import type { Ctv, CtvStatus } from "@/lib/types";

const CTV_STATUS_LABELS: Record<CtvStatus, string> = {
  active: "Hoạt động",
  inactive: "Ngừng",
};

export default function CtvPage() {
  const router = useRouter();
  const { ctvs } = useCtvs();
  const [query, setQuery] = useState("");
  const filtered = ctvs.filter((c) =>
    [c.name, c.phone, c.email].some((f) => f.toLowerCase().includes(query.toLowerCase())),
  );

  const columns: TableColumnsType<Ctv> = [
    { title: "Tên", dataIndex: "name" },
    { title: "SĐT", dataIndex: "phone" },
    { title: "Email", dataIndex: "email" },
    { title: "Tổng đơn", dataIndex: "totalJobs" },
    {
      title: "Hoa hồng",
      dataIndex: "totalCommission",
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (s: CtvStatus) => (
        <Tag color={s === "active" ? "success" : "default"}>{CTV_STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: "Thao tác",
      key: "action",
      render: (_, r) => (
        <Button size="small" onClick={() => router.push(`/ctv/${r.id}`)}>
          Chi tiết
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        breadcrumbs={[{ title: "Quản lý CTV" }]}
        searchPlaceholder="Tìm tên CTV, SĐT…"
        onSearch={setQuery}
        searchValue={query}
        primaryAction={{ label: "+ CTV mới", href: "/ctv/new" }}
      />
      <div style={{ padding: 16 }}>
        <Table rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} />
      </div>
    </>
  );
}
