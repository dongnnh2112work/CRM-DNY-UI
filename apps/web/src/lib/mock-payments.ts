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
  {
    id: "pay4", orderId: "o3", orderNumber: "ORD-2026-003", customerId: "c4", customerName: "Tran Thi B",
    totalAmount: 3_300_000, paidAmount: 1_100_000, remaining: 2_200_000, status: "partial",
    installments: [
      { id: "pi6", amount: 1_100_000, dueDate: "2026-07-01", paidDate: "2026-07-01", method: "Bank transfer", status: "paid", note: "Deposit" },
      { id: "pi7", amount: 2_200_000, dueDate: "2026-08-01", status: "pending", note: "Balance" },
    ],
  },
  {
    id: "pay5", orderId: "o5", orderNumber: "ORD-2026-005", customerId: "c1", customerName: "ABC Corp",
    totalAmount: 12_100_000, paidAmount: 0, remaining: 12_100_000, status: "unpaid",
    installments: [
      { id: "pi8", amount: 6_050_000, dueDate: "2026-07-25", status: "overdue", note: "50%" },
      { id: "pi9", amount: 6_050_000, dueDate: "2026-08-25", status: "pending", note: "50%" },
    ],
  },
  {
    id: "pay6", orderId: "o6", orderNumber: "ORD-2026-006", customerId: "c5", customerName: "XYZ Trading",
    totalAmount: 2_200_000, paidAmount: 2_200_000, remaining: 0, status: "paid",
    installments: [
      { id: "pi10", amount: 2_200_000, dueDate: "2026-07-10", paidDate: "2026-07-09", method: "Cash", status: "paid", note: "Full" },
    ],
  },
  {
    id: "pay7", orderId: "o7", orderNumber: "ORD-2026-007", customerId: "c3", customerName: "Tech Startup JSC",
    totalAmount: 7_700_000, paidAmount: 3_850_000, remaining: 3_850_000, status: "partial",
    installments: [
      { id: "pi11", amount: 3_850_000, dueDate: "2026-08-01", paidDate: "2026-07-30", method: "Bank transfer", status: "paid", note: "Deposit" },
      { id: "pi12", amount: 3_850_000, dueDate: "2026-09-01", status: "pending", note: "Final" },
    ],
  },
  {
    id: "pay8", orderId: "o8", orderNumber: "ORD-2026-008", customerId: "c2", customerName: "Nguyen Van A",
    totalAmount: 9_900_000, paidAmount: 0, remaining: 9_900_000, status: "unpaid",
    installments: [
      { id: "pi13", amount: 9_900_000, dueDate: "2026-08-05", status: "pending", note: "Full" },
    ],
  },
  {
    id: "pay9", orderId: "o9", orderNumber: "ORD-2026-009", customerId: "c5", customerName: "XYZ Trading",
    totalAmount: 1_100_000, paidAmount: 1_100_000, remaining: 0, status: "paid",
    installments: [
      { id: "pi14", amount: 1_100_000, dueDate: "2026-07-18", paidDate: "2026-07-18", method: "Bank transfer", status: "paid", note: "Full" },
    ],
  },
  {
    id: "pay10", orderId: "o10", orderNumber: "ORD-2026-010", customerId: "c4", customerName: "Tran Thi B",
    totalAmount: 15_400_000, paidAmount: 5_000_000, remaining: 10_400_000, status: "partial",
    installments: [
      { id: "pi15", amount: 5_000_000, dueDate: "2026-07-20", paidDate: "2026-07-19", method: "Bank transfer", status: "paid", note: "Deposit" },
      { id: "pi16", amount: 5_200_000, dueDate: "2026-08-20", status: "pending", note: "Mid" },
      { id: "pi17", amount: 5_200_000, dueDate: "2026-09-20", status: "pending", note: "Final" },
    ],
  },
  {
    id: "pay11", orderId: "o11", orderNumber: "ORD-2026-011", customerId: "c1", customerName: "ABC Corp",
    totalAmount: 6_600_000, paidAmount: 0, remaining: 6_600_000, status: "unpaid",
    installments: [
      { id: "pi18", amount: 3_300_000, dueDate: "2026-07-08", status: "overdue", note: "50%" },
      { id: "pi19", amount: 3_300_000, dueDate: "2026-08-08", status: "pending", note: "50%" },
    ],
  },
  {
    id: "pay12", orderId: "o12", orderNumber: "ORD-2026-012", customerId: "c3", customerName: "Tech Startup JSC",
    totalAmount: 4_400_000, paidAmount: 4_400_000, remaining: 0, status: "paid",
    installments: [
      { id: "pi20", amount: 4_400_000, dueDate: "2026-08-02", paidDate: "2026-08-01", method: "Cash", status: "paid", note: "Full" },
    ],
  },
];
