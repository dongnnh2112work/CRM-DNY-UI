"use client";

import { CheckOutlined, DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Divider, Input, Select, Space, theme } from "antd";
import { useMemo, useState, type MouseEvent } from "react";
import { ds } from "@/lib/design-tokens";
import { useServiceCategoryConfig } from "@/lib/service-category-store";
import { useT } from "@/lib/use-t";

/**
 * Service category Select with inline CRUD (add / remove).
 * Values are labels stored on `Service.category` (matches existing API data).
 */
export function ServiceCategorySelect({
  value,
  onChange,
  disabled,
  allowManage = true,
}: {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  allowManage?: boolean;
}) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const { categories, categoryOptions, addCategory, removeCategory, ensureCategoryLabel } =
    useServiceCategoryConfig();
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  const options = useMemo(() => {
    const base = categories.map((c) => ({ key: c.key, value: c.label, label: c.label }));
    const v = value?.trim();
    if (v && !base.some((o) => o.value === v)) {
      base.push({ key: `orphan:${v}`, value: v, label: v });
    }
    return base;
  }, [categories, value]);

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const onAdd = () => {
    const label = draft.trim();
    if (!label) {
      message.warning(t("service.categoryEnterName"));
      return;
    }
    const created = addCategory(label);
    if (!created) {
      message.warning(t("service.categoryExists"));
      return;
    }
    setDraft("");
    onChange?.(created.label);
    message.success(t("service.categoryAdded"));
  };

  const onRemove = (key: string, label: string) => {
    if (key.startsWith("orphan:")) {
      if (value === label) onChange?.("");
      return;
    }
    const result = removeCategory(key);
    if (!result.ok) {
      message.warning(result.reason);
      return;
    }
    if (value === label) onChange?.("");
    message.success(t("service.categoryDeleted", { label }));
  };

  const pick = (next: string) => {
    ensureCategoryLabel(next);
    onChange?.(next);
    setOpen(false);
  };

  if (!allowManage) {
    return (
      <Select
        value={value || undefined}
        onChange={onChange}
        disabled={disabled}
        options={categoryOptions}
        placeholder={t("common.selectCategory")}
        showSearch
        optionFilterProp="label"
      />
    );
  }

  return (
    <Select
      value={value || undefined}
      open={open}
      onOpenChange={setOpen}
      onChange={(next) => {
        if (next) pick(next);
      }}
      disabled={disabled}
      options={options.map((o) => ({ value: o.value, label: o.label }))}
      placeholder={t("common.selectCategory")}
      optionFilterProp="label"
      popupRender={() => (
        <div
          style={{
            padding: 4,
            background: token.colorBgElevated,
            borderRadius: token.borderRadiusLG,
          }}
          onMouseDown={(e) => {
            // Keep Select open when clicking list chrome; allow inputs to take focus.
            const el = e.target as HTMLElement | null;
            if (el?.closest?.("input, textarea, button")) return;
            e.preventDefault();
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.key}
              role="button"
              tabIndex={0}
              onClick={() => pick(opt.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") pick(opt.value);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              <span style={{ flex: 1, fontSize: ds.fontSize.bodySm }}>{opt.label}</span>
              {opt.value === value ? (
                <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
              ) : null}
              {!opt.key.startsWith("orphan:") ? (
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  aria-label={t("service.categoryDeleteAria", { label: opt.label })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(opt.key, opt.label);
                  }}
                />
              ) : null}
            </div>
          ))}
          <Divider style={{ margin: "8px 0" }} />
          <Space.Compact style={{ width: "100%", padding: "0 4px 4px" }}>
            <Input
              size="small"
              placeholder={t("service.categoryNewName")}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPressEnter={onAdd}
              onClick={stop}
              onMouseDown={stop}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <Button
              size="small"
              type="primary"
              icon={<PlusOutlined />}
              aria-label={t("service.categoryAddAria")}
              onClick={onAdd}
              onMouseDown={stop}
            />
          </Space.Compact>
        </div>
      )}
    />
  );
}
