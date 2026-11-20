import type { AppNotification } from "@/lib/types";
import type { ApiNotification } from "@/modules/notifications/api";
import {
  categoryForType,
  isKnownNotificationType,
  normalizeCategory,
  notificationHref,
} from "@/modules/notifications/model";

export function mapApiNotificationToUi(n: ApiNotification): AppNotification {
  const rawType = n.type;
  const category = normalizeCategory(n.category) ?? categoryForType(rawType);
  return {
    id: n.id,
    userId: n.recipientUserId,
    type: isKnownNotificationType(rawType) ? rawType : "unknown",
    rawType: isKnownNotificationType(rawType) ? undefined : rawType,
    category,
    title: n.title?.trim() ?? "",
    body: n.body ?? "",
    href: notificationHref({
      href: n.href,
      type: n.type,
      category,
      sourceType: n.sourceType,
      sourceId: n.sourceId,
    }),
    orderId: n.sourceType === "order" ? (n.sourceId ?? undefined) : undefined,
    read: Boolean(n.readAt),
    createdAt: n.createdAt,
    dedupeKey: n.dedupeKey ?? undefined,
  };
}
