import { describe, expect, it } from "vitest";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import type { ApiNotification } from "@/modules/notifications/api";

function notification(partial: Partial<ApiNotification>): ApiNotification {
  return {
    id: "ntf-1",
    recipientUserId: "user-1",
    type: "order_mentioned",
    title: "Mai nhắc bạn trong đơn DH-12",
    body: "Xem giúp phần hồ sơ",
    readAt: null,
    sourceType: "order",
    sourceId: "order-9",
    href: "/orders/order-9?tab=notes",
    dedupeKey: null,
    createdAt: "2026-11-20T04:00:00.000Z",
    updatedAt: "2026-11-20T04:00:00.000Z",
    ...partial,
  };
}

describe("mapApiNotificationToUi order_mentioned", () => {
  it("keeps the type and navigates to the server href", () => {
    const ui = mapApiNotificationToUi(notification({}));
    expect(ui.type).toBe("order_mentioned");
    expect(ui.category).toBe("orders");
    expect(ui.href).toBe("/orders/order-9?tab=notes");
    expect(ui.id).toBe("ntf-1");
    expect(ui.read).toBe(false);
  });

  it("falls back to the notes tab when href is missing", () => {
    const ui = mapApiNotificationToUi(notification({ href: null, sourceId: "order-9" }));
    expect(ui.type).toBe("order_mentioned");
    expect(ui.href).toBe("/orders/order-9?tab=notes");
  });
});
