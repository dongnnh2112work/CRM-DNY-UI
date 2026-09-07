import { num } from "@/lib/http/message";
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";
import type { ApiExpense } from "@/modules/expenses/api";

function mapStatus(status: string): OrderExpenseStatus {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";
  return "pending";
}

export function mapApiExpenseToUi(e: ApiExpense, orderNumber?: string): OrderExpense {
  return {
    id: e.id,
    orderId: e.orderId,
    orderNumber,
    projectName: orderNumber || e.title,
    amount: num(e.amount),
    title: e.title,
    note: e.note ?? e.description ?? undefined,
    requestedById: e.requestedByUserId,
    requestedByName: e.requestedByUserId,
    requestedAt: (e.requestedAt || e.createdAt).slice(0, 10),
    payeeName: e.payeeName ?? "",
    bankAccount: "",
    bankName: "",
    status: mapStatus(e.status),
    reviewedById: e.reviewedByUserId ?? undefined,
    reviewedAt: e.reviewedAt?.slice(0, 10),
    reviewNote: e.reviewNote ?? undefined,
  };
}
