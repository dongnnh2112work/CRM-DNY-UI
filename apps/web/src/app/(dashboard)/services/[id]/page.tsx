"use client";

import { Button, Descriptions, Space, Tag, Typography } from "antd";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_SERVICES } from "@/lib/mock-services";

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const service = MOCK_SERVICES.find((s) => s.id === id);
  if (!service) return <div style={{ padding: 24 }}>Không tìm thấy dịch vụ.</div>;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Dịch vụ", href: "/services" }, { title: service.name }]}>
        <Space>
          <Button>Sửa</Button>
          <Button danger>{service.status === "active" ? "Ngừng hoạt động" : "Kích hoạt"}</Button>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>{service.name}</Typography.Title>
          <Tag color={service.status === "active" ? "success" : "default"}>
            {service.status === "active" ? "Hoạt động" : "Ngừng"}
          </Tag>
        </Space>
        <Descriptions bordered column={1} size="small" style={{ maxWidth: 560 }}>
          <Descriptions.Item label="Mã">{service.code}</Descriptions.Item>
          <Descriptions.Item label="Danh mục">{service.category}</Descriptions.Item>
          <Descriptions.Item label="Đơn giá">{service.unitPrice.toLocaleString()} ₫</Descriptions.Item>
          <Descriptions.Item label="Thời gian xử lý">{service.processingDays} ngày</Descriptions.Item>
        </Descriptions>
      </div>
    </>
  );
}
