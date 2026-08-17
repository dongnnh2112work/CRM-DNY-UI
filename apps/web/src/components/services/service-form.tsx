"use client";

import { App, Button, Divider, Form, Input, InputNumber, Select, Space, Typography } from "antd";
import { useEffect } from "react";
import { ServiceExtraFormFields } from "@/components/services/service-extra-form-fields";
import { ds } from "@/lib/design-tokens";
import { confirmDiscardIfDirty } from "@/lib/confirm-discard";
import { vndInputProps } from "@/lib/format-vnd";
import { getServiceFormExtraFields, splitServiceFormValues } from "@/lib/service-fields";
import type { FieldDefinition, Service, ServiceStatus } from "@/lib/types";

const CATEGORIES = ["Work Permit", "Visa", "License", "Legal", "Other"];

export function ServiceForm({
  service,
  fieldDefs,
  onSubmit,
  onCancel,
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
    status?: ServiceStatus;
    customFields: Record<string, unknown>;
  }) => void | Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  loading?: boolean;
}) {
  const { modal } = App.useApp();
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
        status: service.status,
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
      {service ? (
        <Form.Item name="status" label="Trạng thái" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "active", label: "Hoạt động" },
              { value: "inactive", label: "Ngừng" },
            ]}
          />
        </Form.Item>
      ) : null}

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

      <Space>
        {onCancel ? (
          <Button onClick={() => confirmDiscardIfDirty(modal, form, onCancel)} disabled={loading}>
            Hủy
          </Button>
        ) : null}
        <Button type="primary" htmlType="submit" loading={loading} disabled={loading}>
          {submitLabel}
        </Button>
      </Space>
    </Form>
  );
}
