import { num } from "@/lib/http/message";
import type { VatInvoice, VatInvoiceLine, VatStatus } from "@/lib/types";
import type { ApiVatInvoice } from "@/modules/vat/api";

function mapStatus(status: string): VatStatus {
  const s = status.toUpperCase();
  if (s === "ISSUED") return "issued";
  if (s === "CANCELLED") return "cancelled";
  return "draft";
}

function mapLines(lines: unknown, fallbackAmount: number): VatInvoiceLine[] {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [{ description: "", amount: fallbackAmount }, { description: "", amount: 0 }];
  }
  return lines.map((line) => {
    if (line && typeof line === "object") {
      const row = line as { description?: string; amount?: string | number };
      return { description: row.description ?? "", amount: num(row.amount) };
    }
    return { description: "", amount: 0 };
  });
}

export function mapApiVatToUi(v: ApiVatInvoice, orderNumber?: string, contractNumber?: number): VatInvoice {
  const amount = num(v.netAmount);
  return {
    id: v.id,
    invoiceNumber: v.invoiceNumber,
    orderId: v.orderId,
    orderNumber: orderNumber ?? "",
    contractNumber,
    customerName: v.customerName ?? "",
    taxCode: v.customerTaxCode ?? undefined,
    amount,
    taxRate: num(v.vatRate, 10),
    taxAmount: num(v.vatAmount),
    totalAmount: num(v.grossAmount),
    issueDate: v.issueDate?.slice(0, 10) ?? v.createdAt.slice(0, 10),
    status: mapStatus(v.status),
    lines: mapLines(v.lines, amount),
  };
}
