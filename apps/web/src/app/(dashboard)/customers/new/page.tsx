"use client";

import { App, Button, Form, Input, Select, Space } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExtraFormFields } from "@/components/shared/extra-form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { ds } from "@/lib/design-tokens";
import {
  collectCustomFields,
  getCustomerFormExtraFields,
} from "@/lib/customer-helpers";
import { useCustomers } from "@/lib/customers-store";
import { apiErrorMessage } from "@/lib/http/message";
import { useServices } from "@/lib/services-store";
import { useUsers } from "@/lib/users-store";
import { customersApi } from "@/modules/customers/api";
import { mapApiCustomerToUi, mapUiCustomerToApi } from "@/modules/customers/map-to-ui";
import { useT } from "@/lib/use-t";

export default function NewCustomerPage() {
  const t = useT();
  const router = useRouter();
  const { message, modal } = App.useApp();
  const { addCustomers, fieldDefs } = useCustomers();
  const { users } = useUsers();
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
        onFinish={async (values) => {
          setSaving(true);
          try {
            const created = await customersApi.create(
              mapUiCustomerToApi({
                name: values.name,
                phone: values.phone,
                email: values.email,
                company: values.company,
                taxCode: values.taxCode,
                owner: values.owner,
                customFields: collectCustomFields(values, extraFields),
              }),
            );
            addCustomers([
              {
                ...mapApiCustomerToUi(created),
                address: values.address,
                usedServiceIds: values.usedServiceIds ?? [],
                customFields: collectCustomFields(values, extraFields),
              },
            ]);
            message.success(t("customer.created"));
            router.push("/customers");
          } catch (err) {
            message.error(apiErrorMessage(err, t("customer.loadFailed")));
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
        <Form.Item name="owner" label={t("field.owner")}>
          <Select options={users.filter((u) => u.status === "active").map((u) => ({ value: u.id, label: u.name }))} />
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
