"use client";

import { App, Button, Descriptions, Popconfirm, Segmented, Space, Tabs, Tag, Typography } from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { OrderApprovalPanel } from "@/components/orders/order-approval-panel";
import { OrderDocuments } from "@/components/orders/order-documents";
import { LicenseUpload } from "@/components/orders/license-upload";
import { PageHeader } from "@/components/shared/page-header";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { APPROVAL_STATUS_LABELS, ORDER_STAGES, type Order } from "@/lib/types";

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, ready, updateOrder, deleteOrder } = useOrders();
  const { getByOrderId } = usePayments();
  const order = getById(id);
  const payment = order ? getByOrderId(order.id) : undefined;
  const [actingAs, setActingAs] = useState<"submitter" | "reviewer">("reviewer");

  if (!ready) return null;
  if (!order) return <div style={{ padding: 24 }}>Không tìm thấy đơn hàng.</div>;

  const stageMeta = ORDER_STAGES.find((s) => s.key === order.stage);
  const workFileCount = order.attachments.filter((a) => !a.deleted).length;
  const licenseFileCount = (order.licenseAttachments ?? []).filter((a) => !a.deleted).length;

  const persist = (next: Order) => {
    updateOrder(order.id, next);
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Đơn hàng", href: "/orders" }, { title: order.orderNumber }]}>
        <Space wrap>
          <Button
            type="primary"
            onClick={() => {
              if (payment) router.push(`/payments/${payment.id}`);
              else router.push("/payments");
            }}
          >
            Thanh toán
            {payment ? ` (${formatVndDisplay(payment.remaining)} còn lại)` : ""}
          </Button>
          <Button onClick={() => router.push("/vat/new")}>Tạo VAT</Button>
          <Popconfirm
            title="Hủy đơn này?"
            description="Đơn sẽ chuyển sang giai đoạn Đã hủy."
            okText="Hủy đơn"
            cancelText="Đóng"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              updateOrder(order.id, { stage: "cancelled", approvalStatus: "none", pendingTransition: undefined });
              message.success("Đã hủy đơn");
            }}
          >
            <Button danger>Hủy đơn</Button>
          </Popconfirm>
          <Popconfirm
            title="Xóa đơn hàng?"
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              deleteOrder(order.id);
              message.success("Đã xóa đơn");
              router.push("/orders");
            }}
          >
            <Button danger type="primary">
              Xóa
            </Button>
          </Popconfirm>
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
          <Tag>{workFileCount} hồ sơ</Tag>
          {licenseFileCount > 0 && <Tag color="green">{licenseFileCount} giấy phép</Tag>}
        </Space>

        <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Khách hàng">
            <Link href={`/customers/${order.customerId}`}>{order.customerName}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Dịch vụ">{order.serviceName}</Descriptions.Item>
          <Descriptions.Item label="Giá trị Ratecard">{formatVndDisplay(order.value)}</Descriptions.Item>
          <Descriptions.Item label="Kênh">{order.channel.toUpperCase()}</Descriptions.Item>
          {order.ctvName && (
            <Descriptions.Item label="CTV">
              <Link href={`/ctv/${order.ctvId}`}>{order.ctvName}</Link>
            </Descriptions.Item>
          )}
          {order.channel === "ctv" && order.ctvPrice != null && (
            <>
              <Descriptions.Item label="Giá CTV">{formatVndDisplay(order.ctvPrice)}</Descriptions.Item>
              <Descriptions.Item label="Commission">
                <Tag color="green">{formatVndDisplay(order.ctvPrice - order.value)}</Tag>
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
              label: `Hồ sơ làm việc (${workFileCount})`,
              children: (
                <OrderDocuments
                  attachments={order.attachments}
                  onChange={(attachments) => persist({ ...order, attachments })}
                  uploaderName={order.submitterName}
                />
              ),
            },
            {
              key: "license",
              label: `Giấy phép final (${licenseFileCount})`,
              children: (
                <div>
                  <Typography.Paragraph type="secondary">
                    File giấy phép / văn bản được cấp phép — lưu final, tách bạch với hồ sơ làm việc.
                    Thường tải lên khi yêu cầu chuyển sang Hoàn thành.
                  </Typography.Paragraph>
                  <LicenseUpload
                    files={order.licenseAttachments ?? []}
                    onChange={(licenseAttachments) => persist({ ...order, licenseAttachments })}
                    uploaderName={order.submitterName}
                  />
                </div>
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
                  <OrderApprovalPanel order={order} onChange={persist} actingAs={actingAs} />
                </>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
