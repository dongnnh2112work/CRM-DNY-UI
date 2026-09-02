"use client";

import { CheckOutlined, DeleteOutlined, DownOutlined, PlusOutlined } from "@ant-design/icons";
import { App, Button, Divider, Dropdown, Input, Tag, theme } from "antd";
import { useState, type MouseEvent } from "react";
import { ColorSwatchPicker } from "@/components/shared/color-swatch-picker";
import { ds } from "@/lib/design-tokens";
import { resolveStatusColor, useStatusMeta } from "@/lib/order-status-store";
import type { StatusModule } from "@/lib/status-config";
import { useT } from "@/lib/use-t";

type Option = { value: string; label: string };

export function StatusSelect({
  module,
  value,
  options,
  onChange,
  disabled,
  manage,
}: {
  module: StatusModule;
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  disabled?: boolean;
  /** Add statuses and change colors inside this dropdown (not a page-level control). */
  manage?: {
    onColorChange: (status: string, hex: string) => void;
    onAdd: (label: string) => { key: string } | null;
    onRemove: (status: string) => { ok: true } | { ok: false; reason: string };
    takenColors: string[];
  };
}) {
  const t = useT();
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const current = useStatusMeta(module, value);
  const [open, setOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const stop = (e: MouseEvent) => {
    e.stopPropagation();
  };

  const addStatus = () => {
    if (!manage) return;
    const label = newLabel.trim();
    if (!label) {
      message.warning(t("status.enterName"));
      return;
    }
    const created = manage.onAdd(label);
    if (!created) {
      message.warning(t("status.noColors"));
      return;
    }
    setNewLabel("");
    message.success(t("status.added"));
  };

  const removeStatus = (key: string, label: string) => {
    if (!manage) return;
    const result = manage.onRemove(key);
    if (!result.ok) {
      message.warning(result.reason);
      return;
    }
    message.success(t("status.deleted", { label }));
  };

  const panel = (
    <div
      onClick={stop}
      onMouseDown={stop}
      style={{
        minWidth: 220,
        padding: 4,
        background: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}
    >
      {options.map((opt) => (
        <StatusSelectOptionRow
          key={opt.value}
          module={module}
          status={opt.value}
          selected={opt.value === value}
          primaryColor={token.colorPrimary}
          colorPicker={
            manage
              ? {
                  takenColors: manage.takenColors,
                  onChange: (hex) => manage.onColorChange(opt.value, hex),
                }
              : undefined
          }
          onSelect={() => {
            if (opt.value !== value) onChange(opt.value);
            setOpen(false);
          }}
          onRemove={
            manage
              ? () => removeStatus(opt.value, opt.label)
              : undefined
          }
        />
      ))}
      {manage ? (
        <>
          <Divider style={{ margin: "8px 0" }} />
          <div style={{ display: "flex", gap: 8, padding: "4px 8px 8px", alignItems: "center" }}>
            <Input
              size="small"
              placeholder={t("status.newName")}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onPressEnter={addStatus}
              onClick={stop}
              onMouseDown={stop}
            />
            <Button size="small" type="text" icon={<PlusOutlined />} onClick={addStatus} />
          </div>
        </>
      ) : null}
    </div>
  );

  return (
    <Dropdown
      trigger={["click"]}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      popupRender={() => panel}
    >
      <Tag
        color={current.color}
        onClick={stop}
        onMouseDown={stop}
        style={{
          cursor: disabled ? "not-allowed" : "pointer",
          marginInlineEnd: 0,
          paddingInline: 10,
          paddingBlock: 3,
          fontSize: ds.fontSize.bodySm,
          fontWeight: 500,
          lineHeight: "22px",
          borderRadius: token.borderRadiusSM,
          userSelect: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {current.label}
        <DownOutlined style={{ fontSize: 10, opacity: 0.75 }} />
      </Tag>
    </Dropdown>
  );
}

function StatusSelectOptionRow({
  module,
  status,
  selected,
  primaryColor,
  colorPicker,
  onSelect,
  onRemove,
}: {
  module: StatusModule;
  status: string;
  selected: boolean;
  primaryColor: string;
  colorPicker?: { takenColors: string[]; onChange: (hex: string) => void };
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const t = useT();
  const meta = useStatusMeta(module, status);
  const takenExceptSelf = colorPicker
    ? colorPicker.takenColors.filter((c) => c.toLowerCase() !== meta.color.toLowerCase())
    : [];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 8px",
        minWidth: 160,
        borderRadius: 6,
        cursor: "pointer",
      }}
    >
      {colorPicker ? (
        <ColorSwatchPicker
          value={meta.color.startsWith("#") ? meta.color : resolveStatusColor(meta.color)}
          takenColors={takenExceptSelf}
          onChange={colorPicker.onChange}
        />
      ) : (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: resolveStatusColor(meta.color),
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ flex: 1, fontSize: ds.fontSize.bodySm }}>{meta.label}</span>
      {selected ? <CheckOutlined style={{ fontSize: 12, color: primaryColor }} /> : null}
      {onRemove ? (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          aria-label={t("status.deleteAria", { label: meta.label })}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        />
      ) : null}
    </div>
  );
}
