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
import { useT } from "@/lib/use-t";

export default function NewCustomerPage() {
  const t = useT();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { addCustomer, fieldDefs } = useCustomers();
  const { services } = useServices();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const extraFields = getCustomerFormExtraFields(fieldDefs);

  return (
    <>
      <PageHeader breadcrumbs={[{ title: t("common.customer"), href: "/customers" }, { title: t("common.new") }]} />
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
            message.success(t("customer.created"));
            router.push("/customers");
          } finally {
            setSaving(false);
          }
        }}
      >
        <Form.Item name="name" label={t("field.name")} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="phone" label={t("field.phone")} rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="email" label={t("field.email")} rules={[{ type: "email" }]}>
          <Input />
        </Form.Item>
        <Form.Item name="company" label={t("field.company")}>
          <Input />
        </Form.Item>
        <Form.Item name="taxCode" label={t("field.taxCode")}>
          <Input />
        </Form.Item>
        <Form.Item name="address" label={t("field.address")}>
          <Input.TextArea rows={2} />
        </Form.Item>
        <Form.Item name="owner" label={t("field.owner")} initialValue="Le Staff A">
          <Select options={CUSTOMER_OWNER_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="usedServiceIds"
          label={t("customer.usedServices")}
          extra={t("customer.usedServicesCreateExtra")}
        >
          <Select
            mode="multiple"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t("customer.selectService")}
            options={services.map((s) => ({ value: s.id, label: s.name }))}
          />
        </Form.Item>
        <ExtraFormFields fields={extraFields} />
        <Space>
          <Button
            onClick={() => confirmDiscardIfDirty(modal, form, () => router.push("/customers"))}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>
          <Button type="primary" htmlType="submit" loading={saving} disabled={saving}>
            {t("common.createCustomer")}
          </Button>
        </Space>
      </Form>
    </>
  );
}
