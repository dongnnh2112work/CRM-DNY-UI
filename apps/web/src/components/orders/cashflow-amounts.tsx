"use client";

import { ds } from "@/lib/design-tokens";
import { formatVndDisplay } from "@/lib/format-vnd";
import { useT } from "@/lib/use-t";

export function CashflowAmounts({ thu, chi }: { thu: number; chi: number }) {
  const t = useT();
  return (
    <div style={{ fontSize: ds.fontSize.caption, lineHeight: 1.5, textAlign: "right" }}>
      <div style={{ color: ds.accentGreen, fontWeight: 600 }}>{t("order.thu", { amount: formatVndDisplay(thu) })}</div>
      <div style={{ color: ds.danger, fontWeight: 600 }}>{t("order.chi", { amount: formatVndDisplay(chi) })}</div>
    </div>
  );
}
