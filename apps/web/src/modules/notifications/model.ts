import type { AppNotificationType, NotificationCategory } from "@/lib/types";

export const NOTIFICATION_CATEGORIES = [
  "orders",
  "expenses",
  "payments",
  "vat",
  "licenses",
  "users",
  "emails",
] as const satisfies readonly NotificationCategory[];

const CATEGORY_ALIASES: Record<string, NotificationCategory> = {
  order: "orders",
  orders: "orders",
  expense: "expenses",
  expenses: "expenses",
  payment: "payments",
  payments: "payments",
  vat: "vat",
  license: "licenses",
  licenses: "licenses",
  user: "users",
  users: "users",
  email: "emails",
  emails: "emails",
};

const TYPE_CATEGORY: Record<string, NotificationCategory> = {
  task_assigned: "orders",
  order_overdue: "orders",
  expense_pending: "expenses",
  expense_reviewed: "expenses",
  payment_overdue: "payments",
  vat_deadline_approaching: "vat",
  vat_overdue: "vat",
  license_expiring: "licenses",
  user_pending: "users",
  user_approved: "users",
  email_sent: "emails",
  email_failed: "emails",
};

export const KNOWN_NOTIFICATION_TYPES = Object.keys(TYPE_CATEGORY) as AppNotificationType[];

const LABEL_KEYS = {
  task_assigned: "notif.type.task_assigned",
  order_overdue: "notif.type.order_overdue",
  expense_pending: "notif.type.expense_pending",
  expense_reviewed: "notif.type.expense_reviewed",
  payment_overdue: "notif.type.payment_overdue",
  vat_deadline_approaching: "notif.type.vat_deadline_approaching",
  vat_overdue: "notif.type.vat_overdue",
  license_expiring: "notif.type.license_expiring",
  user_pending: "notif.type.user_pending",
  user_approved: "notif.type.user_approved",
  email_sent: "notif.type.email_sent",
  email_failed: "notif.type.email_failed",
} as const;

export type NotificationLabelKey = (typeof LABEL_KEYS)[keyof typeof LABEL_KEYS] | "notif.type.unknown";

export type NotificationIconKey =
  | "task"
  | "order-overdue"
  | "expense-pending"
  | "expense-reviewed"
  | "payment"
  | "vat-soon"
  | "vat-overdue"
  | "license"
  | "user-pending"
  | "user-approved"
  | "email-sent"
  | "email-failed"
  | "bell";

export type NotificationTone = "danger" | "warning" | "success" | "info";

export type UnreadCountSnapshot = {
  total: number;
  byCategory: Partial<Record<NotificationCategory, number>>;
};

export type UnreadCountState = UnreadCountSnapshot & {
  /** idle: not loaded yet. ready: endpoint responded. unavailable: missing or failed — hide badges. */
  status: "idle" | "ready" | "unavailable";
};

const SECTION_BY_PREFIX: Array<{ prefix: string; categories: NotificationCategory[] }> = [
  { prefix: "/orders", categories: ["orders", "licenses"] },
  { prefix: "/expense-approvals", categories: ["expenses"] },
  { prefix: "/payments", categories: ["payments"] },
  { prefix: "/vat", categories: ["vat"] },
  { prefix: "/emails", categories: ["emails"] },
  { prefix: "/users", categories: ["users"] },
];

/** Menu keys that show a category badge. Licenses live on the order, so they share that item. */
export const MENU_BADGE_CATEGORIES: Record<string, NotificationCategory[]> = {
  "/orders": ["orders", "licenses"],
  "/expense-approvals": ["expenses"],
  "/payments": ["payments"],
  "/vat": ["vat"],
  "/emails": ["emails"],
  "users-group": ["users"],
};

export function normalizeCategory(value: unknown): NotificationCategory | undefined {
  if (typeof value !== "string") return undefined;
  return CATEGORY_ALIASES[value.trim().toLowerCase()];
}

export function categoryForType(type: string | null | undefined): NotificationCategory | undefined {
  if (!type) return undefined;
  return TYPE_CATEGORY[type];
}

export function isKnownNotificationType(type: string): type is AppNotificationType {
  return Object.prototype.hasOwnProperty.call(TYPE_CATEGORY, type);
}

export function notificationLabelKey(type: string | null | undefined): NotificationLabelKey {
  if (type && Object.prototype.hasOwnProperty.call(LABEL_KEYS, type)) {
    return LABEL_KEYS[type as keyof typeof LABEL_KEYS];
  }
  return "notif.type.unknown";
}

export function notificationVisual(
  type: string | null | undefined,
  title?: string | null,
): { icon: NotificationIconKey; tone: NotificationTone } {
  switch (type) {
    case "task_assigned":
      return { icon: "task", tone: "info" };
    case "order_overdue":
      return { icon: "order-overdue", tone: "danger" };
    case "expense_pending":
      return { icon: "expense-pending", tone: "warning" };
    case "expense_reviewed":
      return { icon: "expense-reviewed", tone: "success" };
    case "payment_overdue":
      return { icon: "payment", tone: "danger" };
    case "vat_deadline_approaching":
      return { icon: "vat-soon", tone: "warning" };
    case "vat_overdue":
      return { icon: "vat-overdue", tone: "danger" };
    case "license_expiring": {
      const text = title ?? "";
      const expired = /hết hạn/i.test(text) && !/sắp/i.test(text);
      return { icon: "license", tone: expired ? "danger" : "warning" };
    }
    case "user_pending":
      return { icon: "user-pending", tone: "warning" };
    case "user_approved":
      return { icon: "user-approved", tone: "success" };
    case "email_sent":
      return { icon: "email-sent", tone: "success" };
    case "email_failed":
      return { icon: "email-failed", tone: "danger" };
    default:
      return { icon: "bell", tone: "info" };
  }
}

function asCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Math.max(0, Math.floor(Number(value)));
  }
  return undefined;
}

/** Accepts the count payload, or `{ data: payload }`. Returns null when the shape is unusable. */
export function parseUnreadCount(raw: unknown): UnreadCountSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const payload =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;
  const bag = payload.byCategory ?? payload.by_category ?? payload.categories;
  const byCategory: Partial<Record<NotificationCategory, number>> = {};
  let sawCategory = false;
  if (bag && typeof bag === "object") {
    sawCategory = true;
    for (const [key, value] of Object.entries(bag as Record<string, unknown>)) {
      const category = normalizeCategory(key);
      const count = asCount(value);
      if (!category || count == null) continue;
      byCategory[category] = (byCategory[category] ?? 0) + count;
    }
  }
  const total = asCount(payload.total ?? payload.unread ?? payload.count);
  if (total == null && !sawCategory) return null;
  const summed = Object.values(byCategory).reduce((sum, n) => sum + (n ?? 0), 0);
  const filled = {} as Record<NotificationCategory, number>;
  for (const key of NOTIFICATION_CATEGORIES) filled[key] = byCategory[key] ?? 0;
  return { total: total ?? summed, byCategory: filled };
}

export function sumCategoryCounts(
  byCategory: Partial<Record<NotificationCategory, number>> | undefined,
  categories: readonly NotificationCategory[],
): number {
  if (!byCategory) return 0;
  return categories.reduce((sum, key) => sum + (byCategory[key] ?? 0), 0);
}

/** Sections whose unread rows are cleared when the user opens that area of the app. */
export function categoriesForPath(pathname: string): NotificationCategory[] {
  const hit = SECTION_BY_PREFIX.find(
    (row) => pathname === row.prefix || pathname.startsWith(`${row.prefix}/`),
  );
  return hit ? [...hit.categories] : [];
}

const INTERNAL_HREF = /^\/(?!\/)/;

export function notificationHref(input: {
  href?: string | null;
  type?: string | null;
  category?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
}): string | undefined {
  const fromServer = input.href?.trim();
  if (fromServer && INTERNAL_HREF.test(fromServer)) return fromServer;

  const type = input.type?.trim() ?? "";
  const category = normalizeCategory(input.category) ?? categoryForType(type);
  const sourceType = input.sourceType?.trim().toLowerCase() ?? "";
  const sourceId = input.sourceId?.trim() ?? "";

  if (sourceType === "order" && sourceId) return `/orders/${sourceId}`;
  if (sourceType === "expense") return "/expense-approvals";
  if (sourceType === "payment") return sourceId ? `/payments/${sourceId}` : "/payments";
  if (sourceType === "email") return "/emails";
  if (sourceType === "user") {
    return type === "user_approved" ? "/dashboard" : "/users/pending";
  }

  if (
    (type === "task_assigned" ||
      type === "order_overdue" ||
      type === "license_expiring" ||
      type === "vat_deadline_approaching" ||
      type === "vat_overdue" ||
      category === "orders" ||
      category === "licenses" ||
      category === "vat") &&
    sourceId
  ) {
    return `/orders/${sourceId}`;
  }
  if (type === "expense_pending" || type === "expense_reviewed" || category === "expenses") {
    return "/expense-approvals";
  }
  if (type === "payment_overdue" || category === "payments") return "/payments";
  if (type === "user_approved") return "/dashboard";
  if (type === "user_pending" || category === "users") return "/users/pending";
  if (type === "email_sent" || type === "email_failed" || category === "emails") return "/emails";
  if (category === "orders" || category === "licenses") return "/orders";
  if (category === "vat") return "/vat";
  return undefined;
}
