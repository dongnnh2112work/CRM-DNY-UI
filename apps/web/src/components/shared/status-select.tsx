"use client";

import { CheckOutlined, DownOutlined } from "@ant-design/icons";
import { Dropdown, Tag, theme } from "antd";
import { ds } from "@/lib/design-tokens";
import { resolveStatusColor, useStatusMeta } from "@/lib/order-status-store";
import type { StatusModule } from "@/lib/status-config";

type Option = { value: string; label: string };

export function StatusSelect({
  module,
  value,
  options,
  onChange,
  disabled,
}: {
  module: StatusModule;
  value: string;
  options: Option[];
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const { token } = theme.useToken();
  const current = useStatusMeta(module, value);

  return (
    <Dropdown
      trigger={["click"]}
      disabled={disabled}
      menu={{
        selectable: true,
        selectedKeys: [value],
        style: { minWidth: 200, padding: 4 },
        items: options.map((opt) => ({
          key: opt.value,
          label: (
            <StatusSelectOptionRow
              module={module}
              status={opt.value}
              selected={opt.value === value}
              primaryColor={token.colorPrimary}
            />
          ),
          onClick: () => {
            if (opt.value !== value) onChange(opt.value);
          },
        })),
      }}
    >
      <Tag
        color={current.color}
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
}: {
  module: StatusModule;
  status: string;
  selected: boolean;
  primaryColor: string;
}) {
  const meta = useStatusMeta(module, status);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "2px 0",
        minWidth: 160,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: resolveStatusColor(meta.color),
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, fontSize: ds.fontSize.bodySm }}>{meta.label}</span>
      {selected ? <CheckOutlined style={{ fontSize: 12, color: primaryColor }} /> : null}
    </div>
  );
}
