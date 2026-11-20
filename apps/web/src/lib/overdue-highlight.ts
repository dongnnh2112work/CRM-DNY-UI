/**
 * Cheap row tint for records that are already past a date on the row.
 * Display only — never creates inbox notifications.
 *
 * "Today" is the Asia/Ho_Chi_Minh civil date, same as the server scan:
 * a deadline of today is not overdue yet.
 */

const CLOSED_STAGES = new Set(["completed", "cancelled", "canceled"]);
const CIVIL_TIME_ZONE = "Asia/Ho_Chi_Minh";

export function todayCivilDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CIVIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isPastDate(value: string | null | undefined, today = todayCivilDate()): boolean {
  if (!value) return false;
  const day = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return day < today;
}

export function isClosedOrderStage(stage: string | null | undefined): boolean {
  if (!stage) return false;
  return CLOSED_STAGES.has(stage.trim().toLowerCase());
}

export function isOrderListOverdue(
  order: {
    stage?: string | null;
    deadline?: string | null;
    needsVat?: boolean;
    vatIssueDeadline?: string | null;
    licenseTone?: "expired" | "expiring" | "ok" | "none" | null;
  },
  today = todayCivilDate(),
): boolean {
  if (isClosedOrderStage(order.stage)) return false;
  if (isPastDate(order.deadline, today)) return true;
  if (order.needsVat && isPastDate(order.vatIssueDeadline, today)) return true;
  return order.licenseTone === "expired";
}

export function isInstallmentVisuallyOverdue(
  installment: { status?: string | null; dueDate?: string | null },
  today = todayCivilDate(),
): boolean {
  if (installment.status === "paid" || installment.status === "cancelled") return false;
  if (installment.status === "overdue") return true;
  return installment.status === "pending" && isPastDate(installment.dueDate, today);
}

export function isPaymentListOverdue(
  payment: {
    status?: string | null;
    installments?: Array<{ status?: string | null; dueDate?: string | null }>;
  },
  today = todayCivilDate(),
): boolean {
  if (payment.status === "paid" || payment.status === "cancelled") return false;
  if (payment.status === "overdue") return true;
  return (payment.installments ?? []).some((row) => isInstallmentVisuallyOverdue(row, today));
}
