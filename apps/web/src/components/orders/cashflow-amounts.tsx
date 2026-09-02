"use client";

import { ds } from "@/lib/design-tokens";
import { formatVndDisplay } from "@/lib/format-vnd";

export function CashflowAmounts({ thu, chi }: { thu: number; chi: number }) {
  return (
    <div style={{ fontSize: ds.fontSize.caption, lineHeight: 1.5, textAlign: "right" }}>
      <div style={{ color: ds.accentGreen, fontWeight: 600 }}>Thu {formatVndDisplay(thu)}</div>
      <div style={{ color: ds.danger, fontWeight: 600 }}>Chi {formatVndDisplay(chi)}</div>
    </div>
  );
}
