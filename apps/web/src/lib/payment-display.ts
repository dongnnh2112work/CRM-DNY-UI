import type { MessageKey } from "@/lib/i18n";

const VOID_STATUSES = new Set(["cancelled", "canceled", "void", "voided"]);

export function paymentMethodMessageKey(method: string | null | undefined): MessageKey | null {
  const key = String(method ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!key) return null;
  if (key === "CASH") return "payment.cash";
  if (key === "BANK_TRANSFER" || key === "TRANSFER") return "payment.bankTransfer";
  if (key === "QR_PAYMENT" || key === "QR") return "payment.qr";
  return null;
}

export function activeInstallmentCount(rows: Array<{ status?: string | null }>): {
  active: number;
  total: number;
} {
  const total = rows.length;
  const active = rows.filter((row) => !VOID_STATUSES.has(String(row.status ?? "").trim().toLowerCase())).length;
  return { active, total };
}

/** Default count is active only. When some rows are void, show active/total. */
export function installmentCountLabel(
  rows: Array<{ status?: string | null }>,
  formatActiveOf: (active: number, total: number) => string,
): string {
  const { active, total } = activeInstallmentCount(rows);
  if (active === total) return String(active);
  return formatActiveOf(active, total);
}
