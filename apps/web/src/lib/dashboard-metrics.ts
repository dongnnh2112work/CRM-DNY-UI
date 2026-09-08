import type { PaymentRecord } from "@/lib/types";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Paid revenue from verified installments — last `months` calendar months including current. */
export function buildPaidRevenueByMonth(payments: PaymentRecord[], months = 7) {
  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
  }
  const totals = Object.fromEntries(keys.map((k) => [k, 0])) as Record<string, number>;
  for (const record of payments) {
    for (const inst of record.installments) {
      if (inst.status !== "paid" || !inst.paidDate) continue;
      const key = inst.paidDate.slice(0, 7);
      if (key in totals) totals[key] += inst.amount;
    }
  }
  return keys.map((month) => ({ month, value: totals[month] ?? 0 }));
}
