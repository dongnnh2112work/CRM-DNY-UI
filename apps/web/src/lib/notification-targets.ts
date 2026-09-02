import { formatVndDisplay } from "@/lib/format-vnd";
import { tt } from "@/lib/i18n";
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
    title: tt("notif.assignedTitle", { number: order.orderNumber }),
    body: `${order.customerName} — ${order.serviceName}`,
    href: `/orders/${order.id}`,
    orderId: order.id,
    dedupeKey: `task_assigned:${order.id}`,
  };
}

export function expensePendingDraft(
  expense: Pick<OrderExpense, "id" | "title" | "amount" | "orderId" | "orderNumber" | "projectName">,
  requesterName: string,
): NotificationDraft {
  const project = expense.projectName || expense.orderNumber || tt("expense.fallbackProject");
  return {
    type: "expense_pending",
    title: tt("notif.expensePendingTitle", { project }),
    body: tt("notif.expenseBody", {
      name: requesterName,
      title: expense.title,
      amount: formatVndDisplay(expense.amount),
    }),
    href: expense.orderId ? `/orders/${expense.orderId}` : "/expense-approvals",
    orderId: expense.orderId,
    dedupeKey: `expense_pending:${expense.id}`,
  };
}

export function expenseReviewedDraft(
  expense: Pick<OrderExpense, "id" | "orderId" | "orderNumber" | "projectName" | "title" | "amount">,
  status: "approved" | "rejected",
  reviewerName: string,
): NotificationDraft {
  const approved = status === "approved";
  const project = expense.projectName || expense.orderNumber || tt("expense.fallbackProject");
  return {
    type: "expense_reviewed",
    title: approved
      ? tt("notif.expenseApprovedTitle", { project })
      : tt("notif.expenseRejectedTitle", { project }),
    body: tt("notif.expenseReviewedBody", {
      name: reviewerName,
      action: approved ? tt("notif.didApprove") : tt("notif.didReject"),
      title: expense.title,
      amount: formatVndDisplay(expense.amount),
    }),
    href: expense.orderId ? `/orders/${expense.orderId}` : "/expense-approvals",
    orderId: expense.orderId,
    dedupeKey: `expense_reviewed:${expense.id}:${status}`,
  };
}
