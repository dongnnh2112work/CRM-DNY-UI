"use client";

import { Button, Descriptions, Segmented, Space, Tabs, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { OrderApprovalPanel } from "@/components/orders/order-approval-panel";
import { OrderDocuments } from "@/components/orders/order-documents";
import { PageHeader } from "@/components/shared/page-header";
import { MOCK_ORDERS } from "@/lib/mock-orders";
import { APPROVAL_STATUS_LABELS, ORDER_STAGES, type Order } from "@/lib/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const initial = useMemo(() => MOCK_ORDERS.find((o) => o.id === id), [id]);
  const [order, setOrder] = useState<Order | undefined>(initial);
  const [actingAs, setActingAs] = useState<"submitter" | "reviewer">("reviewer");

  if (!order) return <div style={{ padding: 24 }}>Không tìm thấy đơn hàng.</div>;
  const stageMeta = ORDER_STAGES.find((s) => s.key === order.stage);
  const fileCount = order.attachments.filter((a) => !a.deleted).length;

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Đơn hàng", href: "/orders" }, { title: order.orderNumber }]}>
        <Space>
          <Button onClick={() => router.push(`/payments`)}>Thanh toán</Button>
          <Button onClick={() => router.push("/vat/new")}>Tạo VAT</Button>
          <Button danger>Hủy đơn</Button>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {order.orderNumber}
          </Typography.Title>
          <Tag color={stageMeta?.color}>{stageMeta?.label}</Tag>
          {order.approvalStatus === "pending_review" && (
            <Tag color="processing">{APPROVAL_STATUS_LABELS.pending_review}</Tag>
          )}
          {order.approvalStatus === "rejected" && (
            <Tag color="error">{APPROVAL_STATUS_LABELS.rejected}</Tag>
          )}
          <Tag>{fileCount} file</Tag>
        </Space>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Khách hàng">
            <Link href={`/customers/${order.customerId}`}>{order.customerName}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Dịch vụ">{order.serviceName}</Descriptions.Item>
          <Descriptions.Item label="Giá trị Ratecard">{order.value.toLocaleString()} ₫</Descriptions.Item>
          <Descriptions.Item label="Kênh">{order.channel.toUpperCase()}</Descriptions.Item>
          {order.ctvName && (
            <Descriptions.Item label="CTV">
              <Link href={`/ctv/${order.ctvId}`}>{order.ctvName}</Link>
            </Descriptions.Item>
          )}
          {order.channel === "ctv" && order.ctvPrice != null && (
            <>
              <Descriptions.Item label="Giá CTV">{order.ctvPrice.toLocaleString()} ₫</Descriptions.Item>
              <Descriptions.Item label="Commission">
                <Tag color="green">{(order.ctvPrice - order.value).toLocaleString()} ₫</Tag>
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                  Giá CTV − Ratecard
                </Typography.Text>
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="Phụ trách">{order.assignedUserName}</Descriptions.Item>
          <Descriptions.Item label="Người gửi">{order.submitterName}</Descriptions.Item>
          <Descriptions.Item label="Người duyệt">{order.reviewerName}</Descriptions.Item>
          <Descriptions.Item label="Ngày tạo">{order.createdAt}</Descriptions.Item>
          {order.notes && (
            <Descriptions.Item label="Ghi chú" span={2}>
              {order.notes}
            </Descriptions.Item>
          )}
        </Descriptions>

        <Tabs
          items={[
            {
              key: "documents",
              label: `Hồ sơ (${fileCount})`,
              children: (
                <OrderDocuments
                  attachments={order.attachments}
                  onChange={(attachments) => setOrder({ ...order, attachments })}
                  uploaderName={order.submitterName}
                />
              ),
            },
            {
              key: "approval",
              label: "Duyệt & Phê duyệt",
              children: (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <Typography.Text type="secondary" style={{ marginRight: 8 }}>
                      Demo vai trò:
                    </Typography.Text>
                    <Segmented
                      value={actingAs}
                      onChange={(v) => setActingAs(v as "submitter" | "reviewer")}
                      options={[
                        { value: "submitter", label: `Người gửi (${order.submitterName})` },
                        { value: "reviewer", label: `Người duyệt (${order.reviewerName})` },
                      ]}
                    />
                  </div>
                  <OrderApprovalPanel order={order} onChange={setOrder} actingAs={actingAs} />
                </>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
