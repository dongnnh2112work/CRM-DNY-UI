import type { Order, VatInvoice, VatInvoiceLine } from "@/lib/types";

/** Thuế suất GTGT thường dùng — không hardcode 10% trên form. */
export const VAT_TAX_RATES = [0, 5, 8, 10] as const;

export function vatAmountsFromLines(lines: VatInvoiceLine[] | undefined, taxRate: number) {
  const amount = (lines ?? []).reduce((sum, line) => sum + (Number(line?.amount) || 0), 0);
  const rate = Number(taxRate) || 0;
  const taxAmount = Math.round((amount * rate) / 100);
  return { amount, taxAmount, totalAmount: amount + taxAmount };
}

export function orderHasContractNumber(order: Pick<Order, "contractNumber">): boolean {
  return typeof order.contractNumber === "number" && order.contractNumber >= 1;
}

export function resolveContractNumber(invoice: VatInvoice, orders: Order[]): number | undefined {
  if (invoice.contractNumber != null) return invoice.contractNumber;
  return orders.find((o) => o.id === invoice.orderId)?.contractNumber;
}
