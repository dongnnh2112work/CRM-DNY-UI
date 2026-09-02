import type { OrderExpense, PaymentRecord } from "@/lib/types";

export type CashflowMonthRow = {
  month: string;
  thu: number;
  chi: number;
};

export type OrderCashflow = {
  thu: number;
  chi: number;
  net: number;
  months: CashflowMonthRow[];
};

export function currentYearMonth(from = new Date()): string {
  return `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
}

export function yearMonthOf(iso?: string): string | undefined {
  if (!iso) return undefined;
  const m = iso.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(m) ? m : undefined;
}

/** `2026-09` → `09/2026` */
export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-");
  if (!y || !m) return ym;
  return `${m}/${y}`;
}

export function cashflowForMonth(flow: OrderCashflow, month: string): CashflowMonthRow {
  return flow.months.find((r) => r.month === month) ?? { month, thu: 0, chi: 0 };
}

/** Thu = đợt thanh toán đã trả. Chi = khoản chi đã duyệt. */
export function buildOrderCashflow(
  payment: PaymentRecord | undefined,
  expenses: OrderExpense[],
): OrderCashflow {
  const byMonth = new Map<string, { thu: number; chi: number }>();
  const bump = (month: string, field: "thu" | "chi", amount: number) => {
    const cur = byMonth.get(month) ?? { thu: 0, chi: 0 };
    cur[field] += amount;
    byMonth.set(month, cur);
  };

  for (const i of payment?.installments ?? []) {
    if (i.status !== "paid") continue;
    const month = yearMonthOf(i.paidDate ?? i.dueDate);
    if (month) bump(month, "thu", i.amount);
  }

  for (const e of expenses) {
    if (e.status !== "approved") continue;
    const month = yearMonthOf(e.reviewedAt ?? e.requestedAt);
    if (month) bump(month, "chi", e.amount);
  }

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, thu: v.thu, chi: v.chi }));

  const thu = payment?.paidAmount ?? 0;
  const chi = expenses
    .filter((e) => e.status === "approved")
    .reduce((sum, e) => sum + e.amount, 0);

  return { thu, chi, net: thu - chi, months };
}
