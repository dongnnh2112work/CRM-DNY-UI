import { num } from "@/lib/http/message";
import { entityDisplayName } from "@/lib/order-helpers";
import type { OrderExpense, OrderExpenseStatus } from "@/lib/types";
import type { ApiExpense } from "@/modules/expenses/api";

/** Ghi vào reviewNote khi hủy phiếu — backend chỉ có reject, UI tách “đã hủy”. */
export const EXPENSE_VOID_NOTE = "VOIDED";

export function isExpenseVoid(status: string, reviewNote?: string | null): boolean {
  return status.toUpperCase() === "REJECTED" && (reviewNote ?? "").trim() === EXPENSE_VOID_NOTE;
}

function mapStatus(status: string, reviewNote?: string | null): OrderExpenseStatus {
  const s = status.toUpperCase();
  if (s === "APPROVED") return "approved";
  if (isExpenseVoid(s, reviewNote)) return "cancelled";
  if (s === "REJECTED") return "rejected";
  return "pending";
}

export function mapApiExpenseToUi(
  e: ApiExpense,
  orderNumber?: string,
  names: { requestedByName?: string; reviewedByName?: string } = {},
): OrderExpense {
  const bank = splitBank(e.description);
  const resolvedOrderNumber = orderNumber || e.orderNumber || undefined;
  const requestedByName = entityDisplayName(names.requestedByName, e.requestedByName);
  const reviewedByName = e.reviewedByUserId
    ? entityDisplayName(names.reviewedByName, e.reviewedByName)
    : undefined;
  return {
    id: e.id,
    orderId: e.orderId,
    orderNumber: resolvedOrderNumber,
    projectName: resolvedOrderNumber || e.title,
    amount: num(e.amount),
    title: e.title,
    note: e.note ?? e.description ?? undefined,
    requestedById: e.requestedByUserId,
    requestedByName: requestedByName === "—" ? "" : requestedByName,
    requestedAt: (e.requestedAt || e.createdAt).slice(0, 10),
    payeeName: e.payeeName ?? "",
    bankAccount: bank.bankAccount,
    bankName: bank.bankName,
    status: mapStatus(e.status, e.reviewNote),
    reviewedById: e.reviewedByUserId ?? undefined,
    reviewedByName: reviewedByName === "—" ? undefined : reviewedByName,
    reviewedAt: e.reviewedAt?.slice(0, 10),
    reviewNote: e.reviewNote ?? undefined,
  };
}

function splitBank(description?: string | null) {
  if (!description?.includes(" · ")) return { bankName: "", bankAccount: "" };
  const [bankName, bankAccount] = description.split(" · ");
  return { bankName: (bankName ?? "").trim(), bankAccount: (bankAccount ?? "").trim() };
}
