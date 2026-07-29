"use client";

import { Descriptions, Table, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_CTVS } from "@/lib/mock-ctv";
import type { CtvJob } from "@/lib/types";

const CTV_STATUS_LABELS: Record<string, string> = {
  active: "Hoạt động",
  inactive: "Ngừng",
};

export default function CtvDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ctv = MOCK_CTVS.find((c) => c.id === id);
  if (!ctv) return <div style={{ padding: 24 }}>Không tìm thấy CTV.</div>;

  const jobColumns = [
    { title: "Đơn hàng", dataIndex: "orderNumber", render: (v: string, r: CtvJob) => <Link href={`/orders/${r.orderId}`}>{v}</Link> },
    { title: "Khách hàng", dataIndex: "customerName" },
    { title: "Dịch vụ", dataIndex: "serviceName" },
    { title: "Bảng giá", dataIndex: "ratecard", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Giá CTV", dataIndex: "ctvPrice", render: (v: number) => `${v.toLocaleString()} ₫` },
    { title: "Hoa hồng", dataIndex: "commission", render: (v: number) => <Tag color="green">{v.toLocaleString()} ₫</Tag> },
  ];

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "CTV", href: "/ctv" }, { title: ctv.name }]} />
      <div style={{ padding: 16 }}>
        <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Tên">{ctv.name}</Descriptions.Item>
          <Descriptions.Item label="SĐT">{ctv.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{ctv.email}</Descriptions.Item>
          <Descriptions.Item label="Trạng thái">
            <Tag color={ctv.status === "active" ? "success" : "default"}>{CTV_STATUS_LABELS[ctv.status] ?? ctv.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Tổng đơn">{ctv.totalJobs}</Descriptions.Item>
          <Descriptions.Item label="Tổng hoa hồng">{ctv.totalCommission.toLocaleString()} ₫</Descriptions.Item>
        </Descriptions>
        <Typography.Title level={5}>Đơn giới thiệu & hoa hồng</Typography.Title>
        <Table rowKey="orderId" columns={jobColumns} dataSource={ctv.jobs} pagination={false} />
      </div>
    </>
  );
}
