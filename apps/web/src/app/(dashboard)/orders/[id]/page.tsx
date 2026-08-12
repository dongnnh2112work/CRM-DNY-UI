"use client";

import {
  App,
  Button,
  Checkbox,
  DatePicker,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { OrderDocuments } from "@/components/orders/order-documents";
import { OrderExpensesPanel } from "@/components/orders/order-expenses-panel";
import { LicenseUpload } from "@/components/orders/license-upload";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/page-loading";
import { StatusSelect } from "@/components/shared/status-select";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { ds } from "@/lib/design-tokens";
import { MOCK_USERS } from "@/lib/mock-users";
import {
  getOrderLicenseExpirySummary,
  isContractNumberTaken,
  licenseExpiryTagColor,
  nextContractNumber,
} from "@/lib/order-helpers";
import {
  canMoveToCompleted,
  getLicenseBlockMessage,
  requiresLicenseForStage,
} from "@/lib/order-workflow";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { useServices } from "@/lib/services-store";
import { ORDER_STAGES, type Order, type OrderStage } from "@/lib/types";

const activeUsers = MOCK_USERS.filter((u) => u.status === "active");

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const { getById, ready, updateOrder, deleteOrder, orders, isContractTaken } = useOrders();
  const { getByOrderId } = usePayments();
  const { config } = useAppReminderConfig();
  const { customers } = useCustomers();
  const { services } = useServices();
  const { ctvs } = useCtvs();
  const order = getById(id);
  const payment = order ? getByOrderId(order.id) : undefined;
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const needsVatEdit = Form.useWatch("needsVat", form) as boolean | undefined;
  const channelEdit = Form.useWatch("channel", form) as string | undefined;

  const suggestedHd = useMemo(
    () => nextContractNumber(orders.filter((o) => o.id !== id)),
    [orders, id],
  );

  useEffect(() => {
    if (!order || !editOpen) return;
    form.setFieldsValue({
      customerId: order.customerId,
      serviceId: order.serviceId,
      channel: order.channel,
      ctvId: order.ctvId,
      value: order.value,
      ctvPrice: order.ctvPrice,
      assignedUserId: order.assignedUserId,
      submitterId: order.submitterId,
      reviewerId: order.reviewerId,
      deadline: order.deadline ? dayjs(order.deadline) : null,
      needsVat: order.needsVat,
      contractNumber: order.contractNumber,
      notes: order.notes,
    });
  }, [order, editOpen, form]);

  if (!ready) return <PageLoading />;
  if (!order) {
    return (
      <EmptyState
        description="Không tìm thấy đơn hàng."
        action={{ label: "Quay lại danh sách", href: "/orders" }}
      />
    );
  }

  const workFileCount = order.attachments.filter((a) => !a.deleted).length;
  const licenseFileCount = (order.licenseAttachments ?? []).filter((a) => !a.deleted).length;
  const licenseSummary = getOrderLicenseExpirySummary(order, config.licenseExpiryWarnMonths);

  const persist = (next: Order) => {
    updateOrder(order.id, next);
  };

  const changeStage = (newStage: OrderStage) => {
    if (newStage === order.stage) return;
    if (requiresLicenseForStage(newStage) && !canMoveToCompleted(order)) {
      message.warning(getLicenseBlockMessage());
      return;
    }
    updateOrder(order.id, {
      stage: newStage,
      approvalStatus: "none",
      pendingTransition: undefined,
    });
    message.success("Đã cập nhật giai đoạn");
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Đơn hàng", href: "/orders" }, { title: order.orderNumber }]}>
        <Space wrap>
          <Button onClick={() => setEditOpen(true)}>Sửa</Button>
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
          <Button
            disabled={!order.needsVat}
            onClick={() => router.push(`/vat/new?orderId=${order.id}`)}
          >
            Tạo VAT
          </Button>
          <Popconfirm
            title="Hủy đơn này?"
            description="Đơn sẽ chuyển sang giai đoạn Đã hủy."
            okText="Hủy đơn"
            cancelText="Đóng"
            okButtonProps={{ danger: true }}
            onConfirm={() => {
              changeStage("cancelled");
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
            <Button danger>Xóa</Button>
          </Popconfirm>
        </Space>
      </PageHeader>
      <div style={{ padding: 16 }}>
        <Space align="center" size="middle" style={{ marginBottom: 16 }} wrap>
          <Typography.Title level={4} style={{ margin: 0 }}>
            {order.orderNumber}
          </Typography.Title>
          <StatusSelect
            module="orderStage"
            value={order.stage}
            options={ORDER_STAGES.map((s) => ({ value: s.key, label: s.label }))}
            onChange={(v) => changeStage(v as OrderStage)}
          />
          <Tag color={order.needsVat ? "blue" : "default"}>
            {order.needsVat ? "Có VAT" : "Không VAT"}
          </Tag>
          {order.contractNumber != null ? <Tag>Số HĐ: {order.contractNumber}</Tag> : null}
          <Tag color={licenseExpiryTagColor(licenseSummary.tone)}>
            {licenseSummary.label}
            {licenseSummary.earliestExpiresAt ? ` · ${licenseSummary.earliestExpiresAt}` : ""}
          </Tag>
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
          <Descriptions.Item label="Xuất VAT">{order.needsVat ? "Có" : "Không"}</Descriptions.Item>
          <Descriptions.Item label="Số HĐ">
            {order.contractNumber != null ? order.contractNumber : "—"}
          </Descriptions.Item>
          <Descriptions.Item label="Hạn xử lý">{order.deadline ?? "—"}</Descriptions.Item>
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
                <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: ds.fontSize.caption }}>
                  Giá CTV − Ratecard
                </Typography.Text>
              </Descriptions.Item>
            </>
          )}
          <Descriptions.Item label="Phụ trách">{order.assignedUserName}</Descriptions.Item>
          <Descriptions.Item label="Người tạo">{order.submitterName}</Descriptions.Item>
          <Descriptions.Item label="Người duyệt chi">{order.reviewerName ?? "—"}</Descriptions.Item>
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
              key: "expenses",
              label: "Thu chi",
              children: <OrderExpensesPanel order={order} />,
            },
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
                    Mỗi giấy phép có ngày cấp / hết hạn. Chuyển sang Hoàn thành bắt buộc có ít nhất 1
                    file giấy phép.
                  </Typography.Paragraph>
                  <LicenseUpload
                    files={order.licenseAttachments ?? []}
                    onChange={(licenseAttachments) => persist({ ...order, licenseAttachments })}
                    uploaderName={order.submitterName}
                  />
                </div>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={`Sửa đơn ${order.orderNumber}`}
        open={editOpen}
        onCancel={() => setEditOpen(false)}
        footer={null}
        width={560}
        destroyOnHidden
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            setSaving(true);
            try {
              const customer = customers.find((c) => c.id === values.customerId);
              const service = services.find((s) => s.id === values.serviceId);
              const assigned = activeUsers.find((u) => u.id === values.assignedUserId);
              const submitter = activeUsers.find((u) => u.id === values.submitterId);
              const reviewer = values.reviewerId
                ? activeUsers.find((u) => u.id === values.reviewerId)
                : undefined;
              const ctv = values.ctvId ? ctvs.find((c) => c.id === values.ctvId) : undefined;
              if (!customer || !service || !assigned || !submitter) {
                message.error("Thiếu thông tin bắt buộc");
                return;
              }

              if (values.needsVat) {
                const hd = Number(values.contractNumber);
                if (!hd || hd < 1) {
                  message.error("Nhập số HĐ hợp lệ");
                  return;
                }
                if (isContractTaken(hd, order.id) || isContractNumberTaken(orders, hd, order.id)) {
                  message.error("Số HĐ đã tồn tại trên đơn khác");
                  return;
                }
              }

              updateOrder(order.id, {
                customerId: customer.id,
                customerName: customer.name,
                serviceId: service.id,
                serviceName: service.name,
                channel: values.channel,
                ctvId: values.channel === "ctv" ? ctv?.id : undefined,
                ctvName: values.channel === "ctv" ? ctv?.name : undefined,
                value: Number(values.value),
                ctvPrice: values.channel === "ctv" ? Number(values.ctvPrice) : undefined,
                assignedUserId: assigned.id,
                assignedUserName: assigned.name,
                submitterId: submitter.id,
                submitterName: submitter.name,
                reviewerId: reviewer?.id,
                reviewerName: reviewer?.name,
                notes: values.notes,
                needsVat: Boolean(values.needsVat),
                contractNumber: values.needsVat ? Number(values.contractNumber) : undefined,
                deadline: values.deadline ? values.deadline.format("YYYY-MM-DD") : undefined,
                vatIssueDeadline: undefined,
              });
              message.success("Đã cập nhật đơn hàng");
              setEditOpen(false);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
          <Form.Item name="serviceId" label="Dịch vụ" rules={[{ required: true }]}>
            <Select
              options={services.map((s) => ({
                value: s.id,
                label: `${s.name} — ${formatVndDisplay(s.unitPrice)}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="channel" label="Kênh" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "direct", label: "Trực tiếp" },
                { value: "website", label: "Website" },
                { value: "referral", label: "Giới thiệu" },
                { value: "ctv", label: "CTV" },
              ]}
            />
          </Form.Item>
          {channelEdit === "ctv" ? (
            <>
              <Form.Item name="ctvId" label="CTV" rules={[{ required: true }]}>
                <Select options={ctvs.map((c) => ({ value: c.id, label: c.name }))} />
              </Form.Item>
              <Form.Item name="ctvPrice" label="Giá CTV" rules={[{ required: true }]}>
                <InputNumber {...vndInputProps} />
              </Form.Item>
            </>
          ) : null}
          <Form.Item name="value" label="Giá trị Ratecard" rules={[{ required: true }]}>
            <InputNumber {...vndInputProps} />
          </Form.Item>
          <Form.Item name="assignedUserId" label="Phụ trách" rules={[{ required: true }]}>
            <Select
              options={activeUsers
                .filter((u) => u.role === "staff")
                .map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <Form.Item name="submitterId" label="Người tạo" rules={[{ required: true }]}>
            <Select options={activeUsers.map((u) => ({ value: u.id, label: u.name }))} />
          </Form.Item>
          <Form.Item name="reviewerId" label="Người duyệt chi">
            <Select
              allowClear
              options={activeUsers
                .filter((u) => u.role === "admin" || u.role === "super_admin" || u.role === "accountant")
                .map((u) => ({ value: u.id, label: u.name }))}
            />
          </Form.Item>
          <Form.Item name="deadline" label="Hạn xử lý đơn">
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="needsVat" valuePropName="checked">
            <Checkbox
              onChange={(e) => {
                if (e.target.checked && !form.getFieldValue("contractNumber")) {
                  form.setFieldValue("contractNumber", suggestedHd);
                }
              }}
            >
              Đơn có xuất hóa đơn VAT
            </Checkbox>
          </Form.Item>
          {needsVatEdit ? (
            <Form.Item
              name="contractNumber"
              label="Số HĐ"
              rules={[{ required: true, message: "Nhập số HĐ" }]}
            >
              <InputNumber min={1} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          <Form.Item name="notes" label="Ghi chú">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saving} disabled={saving}>
            Lưu thay đổi
          </Button>
        </Form>
      </Modal>
    </>
  );
}
