"use client";

import { App, Button, Form, Input, InputNumber, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { ServiceExtraFormFields } from "@/components/services/service-extra-form-fields";
import { vndInputProps } from "@/lib/format-vnd";
import { getServiceFormExtraFields, splitServiceFormValues } from "@/lib/service-fields";
import { useServices } from "@/lib/services-store";

export default function NewServicePage() {
  const router = useRouter();
  const { message } = App.useApp();
  const { addService, fieldDefs } = useServices();
  const extraFields = getServiceFormExtraFields(fieldDefs);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Dịch vụ", href: "/services" }, { title: "Tạo mới" }]} />
      <Form
        layout="vertical"
        style={{ maxWidth: 560, padding: 24 }}
        onFinish={(values) => {
          const { core, customFields } = splitServiceFormValues(values, extraFields);
          addService({ ...core, customFields });
          message.success("Đã tạo dịch vụ");
          router.push("/services");
        }}
      >
        <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="code" label="Mã" rules={[{ required: true }]}>
          <Input style={{ fontFamily: "monospace" }} />
        </Form.Item>
        <Form.Item name="category" label="Danh mục" rules={[{ required: true }]}>
          <Select options={["Work Permit", "Visa", "License", "Legal", "Other"].map((c) => ({ value: c, label: c }))} />
        </Form.Item>
        <Form.Item name="unitPrice" label="Đơn giá (VND)" rules={[{ required: true }]}>
          <InputNumber {...vndInputProps} />
        </Form.Item>
        <Form.Item name="processingDays" label="Thời gian xử lý (ngày)" rules={[{ required: true }]}>
          <InputNumber style={{ width: "100%" }} min={1} />
        </Form.Item>
        <ServiceExtraFormFields fields={extraFields} />
        <Space>
          <Button onClick={() => router.push("/services")}>Hủy</Button>
          <Button type="primary" htmlType="submit">
            Tạo dịch vụ
          </Button>
        </Space>
      </Form>
    </>
  );
}
