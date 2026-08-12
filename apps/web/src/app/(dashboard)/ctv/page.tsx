"use client";

import { App, Button, Popconfirm, type TableColumnsType } from "antd";
import { useRouter } from "next/navigation";
import { useState, type Key } from "react";
import { BulkActionBar } from "@/components/shared/bulk-action-bar";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { useCtvs } from "@/lib/ctvs-store";
import { formatVndDisplay } from "@/lib/format-vnd";
import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import type { Ctv, CtvStatus } from "@/lib/types";

function compareText(a: string, b: string) {
  return a.localeCompare(b, "vi");
}

export default function CtvPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { ctvs, updateCtv, deleteCtv } = useCtvs();
  const [query, setQuery] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

  const filtered = ctvs.filter((c) =>
    matchesTableQuery(query, [
      c.name,
      c.phone,
      c.email,
      c.totalJobs,
      c.totalCommission,
      c.status,
      getStatusMeta("ctv", c.status).label,
    ]),
  );

  const selectedCount = selectedRowKeys.length;
  const clearSelection = () => setSelectedRowKeys([]);

  const bulkSetStatus = (status: CtvStatus) => {
    selectedRowKeys.forEach((id) => updateCtv(String(id), { status }));
    message.success(
      status === "active" ? `Đã kích hoạt ${selectedCount} CTV` : `Đã ngừng ${selectedCount} CTV`,
    );
    clearSelection();
  };

  const bulkDelete = () => {
    selectedRowKeys.forEach((id) => deleteCtv(String(id)));
    message.success(`Đã xóa ${selectedCount} CTV`);
    clearSelection();
  };

  const columns: TableColumnsType<Ctv> = [
    {
      title: "Tên",
      dataIndex: "name",
      sorter: (a, b) => compareText(a.name, b.name),
    },
    {
      title: "SĐT",
      dataIndex: "phone",
      sorter: (a, b) => compareText(a.phone, b.phone),
    },
    {
      title: "Email",
      dataIndex: "email",
      sorter: (a, b) => compareText(a.email, b.email),
    },
    {
      title: "Tổng đơn",
      dataIndex: "totalJobs",
      align: "center",
      sorter: (a, b) => a.totalJobs - b.totalJobs,
    },
    {
      title: "Hoa hồng",
      dataIndex: "totalCommission",
      align: "center",
      sorter: (a, b) => a.totalCommission - b.totalCommission,
      render: (v: number) => formatVndDisplay(v),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      sorter: (a, b) => compareText(a.status, b.status),
      render: (s: CtvStatus) => <StatusBadge module="ctv" status={s} />,
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
        searchPlaceholder="Tìm trong bảng…"
        onSearch={(v) => {
          setQuery(v);
          clearSelection();
        }}
        searchValue={query}
        primaryAction={{ label: "+ CTV mới", href: "/ctv/new" }}
      />
      <DataTable<Ctv>
        rowKey="id"
        columns={columns}
        dataSource={filtered}
        enableRowSelection
        selectedRowKeys={selectedRowKeys}
        onSelectedRowKeysChange={setSelectedRowKeys}
        emptyDescription={
          query.trim() && ctvs.length > 0
            ? "Không tìm thấy kết quả phù hợp."
            : "Chưa có CTV nào."
        }
        emptyAction={
          query.trim() && ctvs.length > 0 ? undefined : { label: "Thêm CTV", href: "/ctv/new" }
        }
        bulkToolbar={
          <BulkActionBar count={selectedCount}>
            <Popconfirm
              title={`Kích hoạt ${selectedCount} CTV đã chọn?`}
              okText="Kích hoạt"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("active")}
            >
              <Button size="small">Đặt hoạt động</Button>
            </Popconfirm>
            <Popconfirm
              title={`Ngừng hoạt động ${selectedCount} CTV đã chọn?`}
              okText="Ngừng"
              cancelText="Hủy"
              onConfirm={() => bulkSetStatus("inactive")}
            >
              <Button size="small">Ngừng hoạt động</Button>
            </Popconfirm>
            <Popconfirm
              title={`Xóa ${selectedCount} CTV đã chọn?`}
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
      />
    </>
  );
}
