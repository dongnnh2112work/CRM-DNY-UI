"use client";

import { Button, Divider, Form, Input, InputNumber, Select, Typography } from "antd";
import { useEffect } from "react";
import { ServiceExtraFormFields } from "@/components/services/service-extra-form-fields";
import { ds } from "@/lib/design-tokens";
import { vndInputProps } from "@/lib/format-vnd";
import { getServiceFormExtraFields, splitServiceFormValues } from "@/lib/service-fields";
import type { FieldDefinition, Service } from "@/lib/types";

const CATEGORIES = ["Work Permit", "Visa", "License", "Legal", "Other"];

export function ServiceForm({
  service,
  fieldDefs,
  onSubmit,
  submitLabel = "Lưu",
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
    customFields: Record<string, unknown>;
  }) => void | Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}) {
  const [form] = Form.useForm();
  const extraFields = getServiceFormExtraFields(fieldDefs);

  useEffect(() => {
    if (service) {
      form.setFieldsValue({
        name: service.name,
        code: service.code,
        category: service.category,
        unitPrice: service.unitPrice,
        processingDays: service.processingDays,
        ...service.customFields,
      });
    } else {
      form.resetFields();
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
      <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true, message: "Nhập tên" }]}>
        <Input />
      </Form.Item>
      <Form.Item name="code" label="Mã" rules={[{ required: true, message: "Nhập mã" }]}>
        <Input style={{ fontFamily: "monospace" }} />
      </Form.Item>
      <Form.Item name="category" label="Danh mục" rules={[{ required: true, message: "Chọn danh mục" }]}>
        <Select options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
      </Form.Item>
      <Form.Item name="unitPrice" label="Đơn giá (VND)" rules={[{ required: true, message: "Nhập đơn giá" }]}>
        <InputNumber {...vndInputProps} />
      </Form.Item>
      <Form.Item
        name="processingDays"
        label="Thời gian xử lý (ngày)"
        rules={[{ required: true, message: "Nhập số ngày" }]}
      >
        <InputNumber style={{ width: "100%" }} min={1} />
      </Form.Item>

      {extraFields.length > 0 ? (
        <>
          <Divider style={{ margin: "8px 0 16px" }}>
            <Typography.Text type="secondary" style={{ fontSize: ds.fontSize.bodySm }}>
              Trường tùy chỉnh
            </Typography.Text>
          </Divider>
          <ServiceExtraFormFields fields={extraFields} />
        </>
      ) : null}

      <Button type="primary" htmlType="submit" block loading={loading} disabled={loading}>
        {submitLabel}
      </Button>
    </Form>
  );
}
