"use client";

import { CheckOutlined } from "@ant-design/icons";
import { Popover } from "antd";
import { useMemo } from "react";
import { ds } from "@/lib/design-tokens";
import { STAGE_COLOR_PALETTE } from "@/lib/status-palette";
import { useT } from "@/lib/use-t";

export function ColorSwatchPicker({
  value,
  takenColors,
  onChange,
  disabled,
}: {
  value: string;
  takenColors: string[];
  onChange: (hex: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const taken = useMemo(
    () => new Set(takenColors.map((c) => c.toLowerCase())),
    [takenColors],
  );

  const content = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, 22px)",
        gap: 8,
        padding: 4,
      }}
    >
      {STAGE_COLOR_PALETTE.map((hex) => {
        const selected = value.toLowerCase() === hex.toLowerCase();
        const isTaken = !selected && taken.has(hex.toLowerCase());
        return (
          <button
            key={hex}
            type="button"
            aria-label={isTaken ? t("common.colorInUse", { color: hex }) : hex}
            disabled={isTaken}
            onClick={(e) => {
              e.stopPropagation();
              if (isTaken) return;
              onChange(hex);
            }}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              border: selected ? `2px solid ${ds.ink}` : `1px solid ${ds.hairline}`,
              background: hex,
              cursor: isTaken ? "not-allowed" : "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isTaken ? 0.28 : 1,
              boxShadow: selected ? `0 0 0 1px ${ds.surface}` : undefined,
            }}
          >
            {selected ? <CheckOutlined style={{ fontSize: 10, color: "#fff" }} /> : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover
      content={disabled ? null : content}
      trigger="click"
      placement="bottomLeft"
      getPopupContainer={(node) => node.parentElement ?? document.body}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `1px solid ${ds.hairline}`,
          background: value,
          cursor: disabled ? "default" : "pointer",
          flexShrink: 0,
          padding: 0,
        }}
        aria-label={t("common.chooseColor")}
      />
    </Popover>
  );
}
