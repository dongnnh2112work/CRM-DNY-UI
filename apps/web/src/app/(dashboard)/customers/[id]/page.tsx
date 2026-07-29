"use client";

import { Button, Descriptions, Space, Tag, Typography } from "antd";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_CUSTOMERS } from "@/lib/mock-customers";

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  active: "Hoạt động",
  lead: "Tiềm năng",
  archived: "Lưu trữ",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const customer = MOCK_CUSTOMERS.find((c) => c.id === id);
  if (!customer) return <div style={{ padding: 24 }}>Không tìm thấy khách hàng.</div>;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Khách hàng", href: "/customers" }, { title: customer.name }]}>
        <Space>
          <Button onClick={() => router.push("/orders/new")}>+ Tạo đơn</Button>
          <Button danger>Lưu trữ</Button>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>{customer.name}</Typography.Title>
          <Tag color={customer.status === "active" ? "success" : "processing"}>
            {CUSTOMER_STATUS_LABELS[customer.status] ?? customer.status}
          </Tag>
        </Space>
        <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
          <Descriptions.Item label="SĐT">{customer.phone}</Descriptions.Item>
          <Descriptions.Item label="Email">{customer.email}</Descriptions.Item>
          <Descriptions.Item label="Công ty">{customer.company || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mã số thuế">{customer.taxCode || "—"}</Descriptions.Item>
          <Descriptions.Item label="Địa chỉ">{customer.address || "—"}</Descriptions.Item>
          <Descriptions.Item label="Phụ trách">{customer.owner}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{customer.createdAt}</Descriptions.Item>
        </Descriptions>
      </div>
    </>
  );
}
