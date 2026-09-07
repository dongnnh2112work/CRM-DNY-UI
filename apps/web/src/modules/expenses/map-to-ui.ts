import { num } from "@/lib/http/message";
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";
import type { ApiExpense } from "@/modules/expenses/api";

function mapStatus(status: string): OrderExpenseStatus {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "approved";
  if (s === "REJECTED") return "rejected";
  return "pending";
}

export function mapApiExpenseToUi(
  e: ApiExpense,
  orderNumber?: string,
  names: { requestedByName?: string; reviewedByName?: string } = {},
): OrderExpense {
  const bank = splitBank(e.description);
  return {
    id: e.id,
    orderId: e.orderId,
    orderNumber,
    projectName: orderNumber || e.title,
    amount: num(e.amount),
    title: e.title,
    note: e.note ?? e.description ?? undefined,
    requestedById: e.requestedByUserId,
    requestedByName: names.requestedByName ?? e.requestedByUserId,
    requestedAt: (e.requestedAt || e.createdAt).slice(0, 10),
    payeeName: e.payeeName ?? "",
    bankAccount: bank.bankAccount,
    bankName: bank.bankName,
    status: mapStatus(e.status),
    reviewedById: e.reviewedByUserId ?? undefined,
    reviewedByName: names.reviewedByName,
    reviewedAt: e.reviewedAt?.slice(0, 10),
    reviewNote: e.reviewNote ?? undefined,
  };
}

function splitBank(description?: string | null) {
  if (!description?.includes(" · ")) return { bankName: "", bankAccount: "" };
  const [bankName, bankAccount] = description.split(" · ");
  return { bankName: (bankName ?? "").trim(), bankAccount: (bankAccount ?? "").trim() };
}
