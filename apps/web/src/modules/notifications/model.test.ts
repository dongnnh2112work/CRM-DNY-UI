import { describe, expect, it } from "vitest";
import {
  categoriesForPath,
  categoryForType,
  notificationHref,
  notificationLabelKey,
  notificationVisual,
  parseUnreadCount,
  sumCategoryCounts,
} from "@/modules/notifications/model";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import { isOrderListOverdue, isPaymentListOverdue } from "@/lib/overdue-highlight";

describe("parseUnreadCount", () => {
  it("reads total and byCategory", () => {
    expect(
      parseUnreadCount({
        total: 4,
        byCategory: { orders: 2, expenses: 0, payments: 1, vat: 1, licenses: 0, users: 0, emails: 0 },
      }),
    ).toEqual({
      total: 4,
      byCategory: { orders: 2, expenses: 0, payments: 1, vat: 1, licenses: 0, users: 0, emails: 0 },
    });
  });

  it("fills every sidebar category with 0 when the server omits a key", () => {
    expect(parseUnreadCount({ total: 1, byCategory: { vat: 1 } })).toEqual({
      total: 1,
      byCategory: {
        orders: 0,
        expenses: 0,
        payments: 0,
        vat: 1,
        licenses: 0,
        users: 0,
        emails: 0,
      },
    });
  });

  it("accepts aliases, snake_case, and a data envelope", () => {
    expect(
      parseUnreadCount({
        data: { total: "3", by_category: { order: 1, license: 2, nope: 9 } },
      }),
    ).toEqual({
      total: 3,
      byCategory: {
        orders: 1,
        expenses: 0,
        payments: 0,
        vat: 0,
        licenses: 2,
        users: 0,
        emails: 0,
      },
    });
  });

  it("returns null when the payload has no counts", () => {
    expect(parseUnreadCount(null)).toBeNull();
    expect(parseUnreadCount({ ok: true })).toBeNull();
  });

  it("treats a zero total as a real response", () => {
    expect(parseUnreadCount({ total: 0 })).toEqual({
      total: 0,
      byCategory: {
        orders: 0,
        expenses: 0,
        payments: 0,
        vat: 0,
        licenses: 0,
        users: 0,
        emails: 0,
      },
    });
  });
});

describe("notification presentation", () => {
  it("maps each known type to a category and a Vietnamese label key", () => {
    expect(categoryForType("payment_overdue")).toBe("payments");
    expect(categoryForType("vat_overdue")).toBe("vat");
    expect(notificationLabelKey("email_failed")).toBe("notif.type.email_failed");
    expect(notificationLabelKey("mystery")).toBe("notif.type.unknown");
    expect(notificationVisual("license_expiring", "Giấy phép hết hạn — DNY1").tone).toBe("danger");
    expect(notificationVisual("license_expiring", "Giấy phép sắp hết hạn — DNY1").tone).toBe("warning");
    expect(notificationVisual("made_up").icon).toBe("bell");
  });

  it("deep-links from href, then source, and ignores unsafe hrefs", () => {
    expect(
      notificationHref({
        href: "/orders/abc",
        type: "task_assigned",
        sourceType: "order",
        sourceId: "abc",
      }),
    ).toBe("/orders/abc");
    expect(notificationHref({ href: "https://evil.example", type: "payment_overdue", sourceType: "payment", sourceId: "p1" })).toBe(
      "/payments/p1",
    );
    expect(notificationHref({ type: "user_approved", sourceType: "user", sourceId: "u1" })).toBe("/dashboard");
    expect(notificationHref({ type: "user_pending", sourceType: "user", sourceId: "u2" })).toBe("/users/pending");
    expect(notificationHref({ type: "expense_reviewed", sourceType: "expense", sourceId: "e1" })).toBe(
      "/expense-approvals",
    );
    expect(notificationHref({ type: "email_sent", sourceType: "email", sourceId: "m1" })).toBe("/emails");
    expect(notificationHref({ type: "vat_overdue", sourceType: "order", sourceId: "o1" })).toBe("/orders/o1");
    expect(notificationHref({ type: "something_new", sourceType: "order", sourceId: "o9" })).toBe("/orders/o9");
    expect(notificationHref({ type: "something_new" })).toBeUndefined();
  });

  it("keeps an unknown type instead of pretending it was an assignment", () => {
    const ui = mapApiNotificationToUi({
      id: "n1",
      recipientUserId: "u1",
      type: "future_type",
      category: "orders",
      title: "Tiêu đề từ máy chủ",
      body: "Nội dung",
      readAt: null,
      sourceType: "order",
      sourceId: "o1",
      href: null,
      dedupeKey: null,
      createdAt: "2026-11-20T00:00:00.000Z",
      updatedAt: "2026-11-20T00:00:00.000Z",
    });
    expect(ui.type).toBe("unknown");
    expect(ui.rawType).toBe("future_type");
    expect(ui.title).toBe("Tiêu đề từ máy chủ");
    expect(ui.category).toBe("orders");
    expect(ui.href).toBe("/orders/o1");
    expect(ui.read).toBe(false);
  });
});

describe("categoriesForPath", () => {
  it("matches a section and its detail routes", () => {
    expect(categoriesForPath("/orders")).toEqual(["orders", "licenses"]);
    expect(categoriesForPath("/orders/abc")).toEqual(["orders", "licenses"]);
    expect(categoriesForPath("/expense-approvals")).toEqual(["expenses"]);
    expect(categoriesForPath("/users/pending")).toEqual(["users"]);
    expect(categoriesForPath("/notifications")).toEqual([]);
    expect(categoriesForPath("/dashboard")).toEqual([]);
  });

  it("sums only the categories on that menu item", () => {
    expect(sumCategoryCounts({ orders: 2, licenses: 100, payments: 4 }, ["orders", "licenses"])).toBe(102);
    expect(sumCategoryCounts({ orders: 1 }, ["payments"])).toBe(0);
  });
});

describe("overdue row highlight", () => {
  const today = "2026-11-20";

  it("tints open orders that are past deadline, VAT, or license expiry", () => {
    expect(isOrderListOverdue({ stage: "processing", deadline: "2026-11-19" }, today)).toBe(true);
    expect(isOrderListOverdue({ stage: "processing", deadline: "2026-11-20" }, today)).toBe(false);
    expect(isOrderListOverdue({ stage: "completed", deadline: "2026-11-01" }, today)).toBe(false);
    expect(
      isOrderListOverdue({ stage: "new", needsVat: true, vatIssueDeadline: "2026-11-01" }, today),
    ).toBe(true);
    expect(isOrderListOverdue({ stage: "new", licenseTone: "expired" }, today)).toBe(true);
    expect(isOrderListOverdue({ stage: "new", licenseTone: "expiring" }, today)).toBe(false);
  });

  it("tints payment rows from status or a pending installment past its due date", () => {
    expect(isPaymentListOverdue({ status: "overdue" }, today)).toBe(true);
    expect(isPaymentListOverdue({ status: "paid", installments: [{ status: "pending", dueDate: "2020-01-01" }] }, today)).toBe(
      false,
    );
    expect(
      isPaymentListOverdue({ status: "unpaid", installments: [{ status: "pending", dueDate: "2026-11-01" }] }, today),
    ).toBe(true);
  });
});
