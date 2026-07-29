import type { PaymentRecord } from "./types";

export const MOCK_PAYMENTS: PaymentRecord[] = [
  {
    id: "pay1", orderId: "o1", orderNumber: "ORD-2026-001", customerId: "c1", customerName: "ABC Corp",
    totalAmount: 5_500_000, paidAmount: 2_750_000, remaining: 2_750_000, status: "partial",
    installments: [
      { id: "pi1", amount: 2_750_000, dueDate: "2026-07-15", paidDate: "2026-07-14", method: "Bank transfer", status: "paid", note: "Deposit 50%" },
      { id: "pi2", amount: 2_750_000, dueDate: "2026-08-15", status: "pending", note: "Final payment" },
    ],
  },
  {
    id: "pay2", orderId: "o2", orderNumber: "ORD-2026-002", customerId: "c3", customerName: "Tech Startup JSC",
    totalAmount: 8_800_000, paidAmount: 0, remaining: 8_800_000, status: "unpaid",
    installments: [
      { id: "pi3", amount: 4_400_000, dueDate: "2026-07-20", status: "overdue", note: "Deposit 50%" },
      { id: "pi4", amount: 4_400_000, dueDate: "2026-08-20", status: "pending", note: "Final" },
    ],
  },
  {
    id: "pay3", orderId: "o4", orderNumber: "ORD-2026-004", customerId: "c2", customerName: "Nguyen Van A",
    totalAmount: 4_500_000, paidAmount: 4_500_000, remaining: 0, status: "paid",
    installments: [
      { id: "pi5", amount: 4_500_000, dueDate: "2026-06-30", paidDate: "2026-06-28", method: "Cash", status: "paid", note: "Full payment" },
    ],
  },
];
