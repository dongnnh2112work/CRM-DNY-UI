"use client";

import { Checkbox, DatePicker, Form, Input, InputNumber, Select } from "antd";
import dayjs from "dayjs";
import { translateSeedFieldLabel } from "@/lib/i18n";
import type { FieldDefinition } from "@/lib/types";
import { vndInputProps } from "@/lib/format-vnd";
import { useT } from "@/lib/use-t";

export function ExtraFormFields({ fields }: { fields: FieldDefinition[] }) {
  const t = useT();
  if (fields.length === 0) return null;

  return (
    <>
      {fields.map((def) => {
        const label = translateSeedFieldLabel(def.label);
        return (
        <Form.Item
          key={def.key}
          name={def.key}
          label={label}
          rules={def.required ? [{ required: true, message: t("common.enterField", { label }) }] : undefined}
          valuePropName={def.type === "checkbox" ? "checked" : "value"}
          {...(def.type === "date"
            ? {
                getValueFromEvent: (d: dayjs.Dayjs | null) => (d ? d.format("YYYY-MM-DD") : undefined),
                getValueProps: (value: string | undefined) => ({
                  value: value ? dayjs(value) : undefined,
                }),
              }
            : {})}
        >
          {def.type === "number" ? (
            <InputNumber {...vndInputProps} />
          ) : def.type === "select" ? (
            <Select
              options={(def.options ?? []).map((o) => ({ value: o, label: o }))}
              allowClear={!def.required}
            />
          ) : def.type === "date" ? (
            <DatePicker style={{ width: "100%" }} format="DD/MM/YYYY" />
          ) : def.type === "checkbox" ? (
            <Checkbox />
          ) : (
            <Input.TextArea rows={2} />
          )}
        </Form.Item>
        );
      })}
    </>
  );
}
