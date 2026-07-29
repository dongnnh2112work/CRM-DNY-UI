import type { VatInvoice } from "./types";

export const MOCK_VAT_INVOICES: VatInvoice[] = [
  { id: "v1", invoiceNumber: "VAT-2026-001", orderId: "o4", orderNumber: "ORD-2026-004", customerName: "Nguyen Van A", taxCode: "", amount: 4_090_909, taxRate: 10, taxAmount: 409_091, totalAmount: 4_500_000, issueDate: "2026-06-30", status: "issued" },
  { id: "v2", invoiceNumber: "VAT-2026-002", orderId: "o1", orderNumber: "ORD-2026-001", customerName: "ABC Corp", taxCode: "0312345678", amount: 5_000_000, taxRate: 10, taxAmount: 500_000, totalAmount: 5_500_000, issueDate: "2026-07-15", status: "draft" },
];
