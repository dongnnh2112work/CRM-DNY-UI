"use client";

import { Checkbox, Form, Input, InputNumber, Select } from "antd";
import type { FieldDefinition } from "@/lib/types";
import { vndInputProps } from "@/lib/format-vnd";

export function ServiceExtraFormFields({ fields }: { fields: FieldDefinition[] }) {
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((def) => (
        <Form.Item
          key={def.key}
          name={def.key}
          label={def.label}
          rules={def.required ? [{ required: true, message: `Nhập ${def.label}` }] : undefined}
          valuePropName={def.type === "checkbox" ? "checked" : "value"}
        >
          {def.type === "number" ? (
            <InputNumber {...vndInputProps} />
          ) : def.type === "select" ? (
            <Select
              options={(def.options ?? []).map((o) => ({ value: o, label: o }))}
              allowClear={!def.required}
            />
          ) : def.type === "date" ? (
            <Input type="date" />
          ) : def.type === "checkbox" ? (
            <Checkbox />
          ) : (
            <Input.TextArea rows={2} />
          )}
        </Form.Item>
      ))}
    </>
  );
}
