"use client";

import { App, Alert, Button, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { formatVndDisplay, vndInputProps } from "@/lib/format-vnd";
import { MOCK_USERS } from "@/lib/mock-users";
import { useOrders } from "@/lib/orders-store";
import { useServices } from "@/lib/services-store";

const activeUsers = MOCK_USERS.filter((u) => u.status === "active");

export default function NewOrderPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { services } = useServices();
  const { customers } = useCustomers();
  const { ctvs, addJob } = useCtvs();
  const { addOrder } = useOrders();
  const [form] = Form.useForm();
  const channel = Form.useWatch("channel", form);
  const submitterId = Form.useWatch("submitterId", form);
  const value = Form.useWatch("value", form) as number | undefined;
  const ctvPrice = Form.useWatch("ctvPrice", form) as number | undefined;
  const serviceId = Form.useWatch("serviceId", form) as string | undefined;

  const selectedService = services.find((s) => s.id === serviceId);
  const commission =
    channel === "ctv" && typeof value === "number" && typeof ctvPrice === "number"
      ? ctvPrice - value
      : null;

  const onServiceChange = (id: string) => {
    const svc = services.find((s) => s.id === id);
    if (svc && (value == null || value === 0)) {
      form.setFieldValue("value", svc.unitPrice);
    }
  };

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Đơn hàng", href: "/orders" }, { title: "Tạo đơn mới" }]} />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: 560, padding: 24 }}
        onFinish={(values) => {
          const customer = customers.find((c) => c.id === values.customerId);
          const service = services.find((s) => s.id === values.serviceId);
          const assigned = activeUsers.find((u) => u.id === values.assignedUserId);
          const submitter = activeUsers.find((u) => u.id === values.submitterId);
          const reviewer = activeUsers.find((u) => u.id === values.reviewerId);
          const ctv = values.ctvId ? ctvs.find((c) => c.id === values.ctvId) : undefined;
          if (!customer || !service || !assigned || !submitter || !reviewer) {
            message.error("Thiếu thông tin bắt buộc");
            return;
          }

          const created = addOrder({
            customerId: customer.id,
            customerName: customer.name,
            serviceId: service.id,
            serviceName: service.name,
            channel: values.channel,
            ctvId: ctv?.id,
            ctvName: ctv?.name,
            value: Number(values.value),
            ctvPrice: values.channel === "ctv" ? Number(values.ctvPrice) : undefined,
            assignedUserId: assigned.id,
            assignedUserName: assigned.name,
            submitterId: submitter.id,
            submitterName: submitter.name,
            reviewerId: reviewer.id,
            reviewerName: reviewer.name,
            notes: values.notes,
          });

          if (ctv && values.channel === "ctv") {
            const ratecard = Number(values.value);
            const price = Number(values.ctvPrice);
            addJob(ctv.id, {
              orderId: created.id,
              orderNumber: created.orderNumber,
              customerName: customer.name,
              serviceName: service.name,
              ratecard,
              ctvPrice: price,
              commission: price - ratecard,
            });
          }

          message.success("Đã tạo đơn hàng");
          router.push(`/orders/${created.id}`);
        }}
      >
        <Form.Item name="customerId" label="Khách hàng" rules={[{ required: true, message: "Chọn khách hàng" }]}>
          <Select
            showSearch
            optionFilterProp="label"
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Form.Item>
        <Form.Item name="serviceId" label="Dịch vụ (1 đơn / 1 dịch vụ)" rules={[{ required: true }]}>
          <Select
            onChange={onServiceChange}
            options={services
              .filter((s) => s.status === "active")
              .map((s) => ({
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
        {channel === "ctv" && (
          <Form.Item name="ctvId" label="Chọn CTV" rules={[{ required: true, message: "Chọn CTV" }]}>
            <Select
              options={ctvs
                .filter((c) => c.status === "active")
                .map((c) => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        )}
        <Form.Item
          name="value"
          label="Giá trị Ratecard (VND)"
          rules={[{ required: true, message: "Nhập giá trị Ratecard" }]}
          extra={
            selectedService
              ? `Ratecard dịch vụ gợi ý: ${formatVndDisplay(selectedService.unitPrice)}`
              : "Giá Ratecard — cơ sở tính hoa hồng"
          }
        >
          <InputNumber {...vndInputProps} />
        </Form.Item>
        {channel === "ctv" && (
          <>
            <Form.Item
              name="ctvPrice"
              label="Giá CTV (VND)"
              rules={[
                { required: true, message: "Nhập giá CTV" },
                {
                  validator: async (_, ctvVal) => {
                    if (ctvVal == null || value == null) return;
                    if (Number(ctvVal) < Number(value)) {
                      throw new Error("Giá CTV thường ≥ Ratecard (Commission = Giá CTV − Ratecard)");
                    }
                  },
                },
              ]}
              extra="Commission = Giá CTV − Giá trị Ratecard"
              dependencies={["value"]}
            >
              <InputNumber {...vndInputProps} />
            </Form.Item>
            {commission != null && (
              <Alert
                type={commission >= 0 ? "success" : "error"}
                showIcon
                style={{ marginBottom: 16 }}
                message={
                  <Typography.Text>
                    Commission dự kiến:{" "}
                    <Typography.Text strong>{formatVndDisplay(commission)}</Typography.Text>
                    <Typography.Text type="secondary"> (Giá CTV − Ratecard)</Typography.Text>
                    {commission < 0 && " — kiểm tra lại giá"}
                  </Typography.Text>
                }
              />
            )}
          </>
        )}
        <Form.Item name="assignedUserId" label="Phụ trách" rules={[{ required: true }]}>
          <Select
            options={activeUsers
              .filter((u) => u.role === "staff")
              .map((u) => ({ value: u.id, label: u.name }))}
          />
        </Form.Item>
        <Form.Item
          name="submitterId"
          label="Người gửi (yêu cầu đổi giai đoạn)"
          rules={[{ required: true, message: "Chọn người gửi" }]}
          extra="Người chuẩn bị hồ sơ và gửi yêu cầu đổi giai đoạn"
        >
          <Select options={activeUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))} />
        </Form.Item>
        <Form.Item
          name="reviewerId"
          label="Người duyệt (phê duyệt đổi giai đoạn)"
          dependencies={["submitterId"]}
          rules={[
            { required: true, message: "Chọn người duyệt" },
            {
              validator: async (_, reviewer) => {
                if (reviewer && submitterId && reviewer === submitterId) {
                  throw new Error("Người duyệt phải khác người gửi");
                }
              },
            },
          ]}
          extra="Người xem xét và phê duyệt trước khi đổi giai đoạn"
        >
          <Select
            options={activeUsers
              .filter((u) => u.id !== submitterId)
              .map((u) => ({ value: u.id, label: `${u.name} (${u.role})` }))}
          />
        </Form.Item>
        <Form.Item name="notes" label="Ghi chú">
          <Input.TextArea rows={3} />
        </Form.Item>
        <Space>
          <Button onClick={() => router.push("/orders")}>Hủy</Button>
          <Button type="primary" htmlType="submit">
            Tạo đơn
          </Button>
        </Space>
      </Form>
    </>
  );
}
