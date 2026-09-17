import type { AppNotification, AppNotificationType } from "@/lib/types";
import type { ApiNotification } from "@/modules/notifications/api";

const TYPES = new Set<AppNotificationType>([
  "task_assigned",
  "order_overdue",
  "license_expiring",
  "vat_deadline_approaching",
  "expense_pending",
  "expense_reviewed",
  "user_pending",
  "user_approved",
  "email_sent",
  "email_failed",
]);

function mapType(type: string): AppNotificationType {
  return TYPES.has(type as AppNotificationType) ? (type as AppNotificationType) : "task_assigned";
}

function hrefOf(n: ApiNotification): string | undefined {
  if (n.sourceType === "order" && n.sourceId) return `/orders/${n.sourceId}`;
  if (n.sourceType === "expense") return "/expense-approvals";
  if (n.sourceType === "payment" && n.sourceId) return `/payments/${n.sourceId}`;
  if (n.sourceType === "user") {
    return n.type === "user_approved" ? "/dashboard" : "/users/pending";
  }
  if (n.sourceType === "email") return "/emails";
  return undefined;
}

export function mapApiNotificationToUi(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    userId: n.recipientUserId,
    type: mapType(n.type),
    title: n.title,
    body: n.body ?? "",
    href: hrefOf(n),
    orderId: n.sourceType === "order" ? n.sourceId ?? undefined : undefined,
    read: Boolean(n.readAt),
    createdAt: n.createdAt,
  };
}
