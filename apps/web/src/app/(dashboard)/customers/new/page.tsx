"use client";

import { App, Button, Form, Input, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExtraFormFields } from "@/components/shared/extra-form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import {
  CUSTOMER_OWNER_OPTIONS,
  collectCustomFields,
  getCustomerFormExtraFields,
} from "@/lib/customer-helpers";
import { useCustomers } from "@/lib/customers-store";
import { useServices } from "@/lib/services-store";

export default function NewCustomerPage() {
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { addCustomer, fieldDefs } = useCustomers();
  const { services } = useServices();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const extraFields = getCustomerFormExtraFields(fieldDefs);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: "Khách hàng", href: "/customers" }, { title: "Tạo mới" }]} />
      <Form
        form={form}
        layout="vertical"
        style={{ maxWidth: ds.formPageMaxWidth, padding: 24 }}
        onFinish={(values) => {
          setSaving(true);
          try {
            addCustomer({
              name: values.name,
              phone: values.phone,
              email: values.email,
              company: values.company,
              taxCode: values.taxCode,
              address: values.address,
              owner: values.owner,
              status: "lead",
              usedServiceIds: values.usedServiceIds ?? [],
              customFields: collectCustomFields(values, extraFields),
            });
            message.success("Đã tạo khách hàng");
            router.push("/customers");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="name" label="Tên" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="SĐT" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label="Email" rules={[{ type: "email" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="company" label="Công ty">
          <Input />
        </Form.Item>
        <Form.Item name="taxCode" label="Mã số thuế">
          <Input />
        </Form.Item>
        <Form.Item name="address" label="Địa chỉ">
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="owner" label="Phụ trách" initialValue="Le Staff A">
          <Select options={CUSTOMER_OWNER_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="usedServiceIds"
          label="Dịch vụ đã sử dụng"
          extra="Ghi nhận dịch vụ khách đã dùng. Đơn hàng sau này sẽ bổ sung tự động."
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn dịch vụ"
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Form.Item>
        <ExtraFormFields fields={extraFields} />
        <Space>
          <Button
            onClick={() => confirmDiscardIfDirty(modal, form, () => router.push("/customers"))}
            disabled={saving}
          >
            Hủy
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
            Tạo khách hàng
          </Button>
        </Space>
      </Form>
    </>
  );
}
