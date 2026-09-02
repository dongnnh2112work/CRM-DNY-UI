"use client";

import { App, Button, Divider, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import { useEffect } from "react";
import { ServiceExtraFormFields } from "@/components/services/service-extra-form-fields";
import { ds } from "@/lib/design-tokens";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { vndInputProps } from "@/lib/format-vnd";
import { DEFAULT_LICENSE_WARN_MONTHS, licenseWarnMonthsOf } from "@/lib/order-helpers";
import { getServiceFormExtraFields, splitServiceFormValues } from "@/lib/service-fields";
import type { FieldDefinition, Service, ServiceStatus } from "@/lib/types";
import { useT } from "@/lib/use-t";

const CATEGORIES = ["Work Permit", "Visa", "License", "Legal", "Other"];

export function ServiceForm({
  service,
  fieldDefs,
  onSubmit,
  onCancel,
  submitLabel,
  loading = false,
}: {
  service?: Service | null;
  fieldDefs: FieldDefinition[];
  onSubmit: (payload: {
    name: string;
    code: string;
    category: string;
    unitPrice: number;
    processingDays: number;
    licenseExpiryWarnMonths?: number;
    status?: ServiceStatus;
    customFields: Record<string, unknown>;
  }) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  loading?: boolean;
}) {
  const t = useT();
  const { modal } = App.useApp();
  const [form] = Form.useForm();
  const extraFields = getServiceFormExtraFields(fieldDefs);
  const resolvedSubmitLabel = submitLabel ?? t("common.save");

  useEffect(() => {
    if (service) {
      form.setFieldsValue({
        name: service.name,
        code: service.code,
        category: service.category,
        unitPrice: service.unitPrice,
        processingDays: service.processingDays,
        licenseExpiryWarnMonths: licenseWarnMonthsOf(service),
        status: service.status,
        ...service.customFields,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ licenseExpiryWarnMonths: DEFAULT_LICENSE_WARN_MONTHS });
    }
  }, [service, form, fieldDefs]);

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={async (values) => {
        const { core, customFields } = splitServiceFormValues(values, extraFields);
        await onSubmit({ ...core, customFields });
      }}
    >
      <Form.Item name="name" label={t("service.name")} rules={[{ required: true, message: t("common.enterName") }]}>
        <Input />
      </Form.Item>
      <Form.Item name="code" label={t("common.code")} rules={[{ required: true, message: t("common.enterCode") }]}>
        <Input style={{ fontFamily: "monospace" }} />
      </Form.Item>
      <Form.Item
        name="category"
        label={t("common.category")}
        rules={[{ required: true, message: t("common.selectCategory") }]}
      >
        <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      </Form.Item>
      <Form.Item
        name="unitPrice"
        label={t("common.unitPriceVnd")}
        rules={[{ required: true, message: t("common.enterUnitPrice") }]}
      >
        <InputNumber {...vndInputProps} />
      </Form.Item>
      <Form.Item
        name="processingDays"
        label={t("common.processingDays")}
        rules={[{ required: true, message: t("common.enterDays") }]}
      >
        <InputNumber style={{ width: "100%" }} min={1} />
      </Form.Item>
      <Form.Item
        name="licenseExpiryWarnMonths"
        label={t("service.licenseWarnMonths")}
        rules={[{ required: true, message: t("service.enterMonths") }]}
        extra={t("service.licenseWarnExtra")}
      >
        <InputNumber style={{ width: "100%" }} min={1} max={6} />
      </Form.Item>
      {service ? (
        <Form.Item name="status" label={t("common.status")} rules={[{ required: true }]}>
          <Select
            options={[
              { value: "active", label: t("status.service.active") },
              { value: "inactive", label: t("status.service.inactive") },
            ]}
          />
        </Form.Item>
      ) : null}

      {extraFields.length > 0 ? (
        <>
          <Divider style={{ margin: "8px 0 16px" }}>
            <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
              {t("service.customFields")}
            </Typography.Text>
          </Divider>
          <ServiceExtraFormFields fields={extraFields} />
        </>
      ) : null}

      <Space>
        {onCancel ? (
          <Button onClick={() => confirmDiscardIfDirty(modal, form, onCancel)} disabled={loading}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button type="primary" htmlType="submit" loading={loading} disabled={loading}>
          {resolvedSubmitLabel}
        </Button>
      </Space>
    </Form>
  );
}
