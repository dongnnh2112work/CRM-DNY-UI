"use client";

import { CheckOutlined, DownOutlined } from "@ant-design/icons";
import { Dropdown, Tag, theme } from "antd";
import { ds } from "@/lib/design-tokens";
import { getStatusMeta, type StatusModule, type StatusTone } from "@/lib/status-config";

const TONE_DOT: Record<StatusTone, string> = {
  success: ds.accentGreen,
  warning: ds.accentOrange,
  error: ds.danger,
  processing: ds.primary,
  default: ds.inkFaint,
};

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
  const current = getStatusMeta(module, value);

  return (
    <Dropdown
      trigger={["click"]}
      disabled={disabled}
      menu={{
        selectable: true,
        selectedKeys: [value],
        style: { minWidth: 200, padding: 4 },
        items: options.map((opt) => {
          const meta = getStatusMeta(module, opt.value);
          const selected = opt.value === value;
          return {
            key: opt.value,
            label: (
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
                    background: TONE_DOT[meta.color],
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontSize: ds.fontSize.bodySm }}>{meta.label}</span>
                {selected ? (
                  <CheckOutlined style={{ fontSize: 12, color: token.colorPrimary }} />
                ) : null}
              </div>
            ),
            onClick: () => {
              if (opt.value !== value) onChange(opt.value);
            },
          };
        }),
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
