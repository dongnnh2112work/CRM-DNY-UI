import { formatVndDisplay } from "@/lib/format-vnd";
import type { AppNotificationType, Order, OrderExpense } from "@/lib/types";

export type NotificationDraft = {
  type: AppNotificationType;
  title: string;
  body: string;
  href?: string;
  orderId?: string;
  dedupeKey?: string;
};

/** Unique related users only — never broadcast to the whole org. */
export function relatedUserIds(
  ids: Array<string | undefined | null>,
  exceptUserId?: string,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || id === exceptUserId || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** Order job owner: người phụ trách đơn — không gửi cho submitter/reviewer/admin nếu không phải job của họ. */
export function orderJobOwnerIds(order: Pick<Order, "assignedUserId">): string[] {
  return relatedUserIds([order.assignedUserId]);
}

export function taskAssignedDraft(
  order: Pick<Order, "id" | "orderNumber" | "customerName" | "serviceName">,
): NotificationDraft {
  return {
    type: "task_assigned",
    title: `Được giao đơn ${order.orderNumber}`,
    body: `${order.customerName} — ${order.serviceName}`,
    href: `/orders/${order.id}`,
    orderId: order.id,
    dedupeKey: `task_assigned:${order.id}`,
  };
}

export function expensePendingDraft(
  order: Pick<Order, "id" | "orderNumber">,
  expense: Pick<OrderExpense, "id" | "title" | "amount">,
  requesterName: string,
): NotificationDraft {
  return {
    type: "expense_pending",
    title: `Yêu cầu duyệt chi — ${order.orderNumber}`,
    body: `${requesterName}: ${expense.title} (${formatVndDisplay(expense.amount)})`,
    href: `/orders/${order.id}`,
    orderId: order.id,
    dedupeKey: `expense_pending:${expense.id}`,
  };
}

export function expenseReviewedDraft(
  expense: Pick<OrderExpense, "id" | "orderId" | "orderNumber" | "title" | "amount">,
  status: "approved" | "rejected",
  reviewerName: string,
): NotificationDraft {
  const approved = status === "approved";
  return {
    type: "expense_reviewed",
    title: approved
      ? `Đã duyệt chi — ${expense.orderNumber}`
      : `Từ chối chi — ${expense.orderNumber}`,
    body: `${reviewerName} ${approved ? "đã duyệt" : "đã từ chối"}: ${expense.title} (${formatVndDisplay(expense.amount)})`,
    href: `/orders/${expense.orderId}`,
    orderId: expense.orderId,
    dedupeKey: `expense_reviewed:${expense.id}:${status}`,
  };
}
