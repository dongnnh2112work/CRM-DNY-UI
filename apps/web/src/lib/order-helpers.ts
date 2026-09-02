import type { Order, OrderAttachment } from "@/lib/types";
import { tt } from "@/lib/i18n";

export const DEFAULT_LICENSE_WARN_MONTHS = 2;

export function licenseWarnMonthsOf(
  service?: { licenseExpiryWarnMonths?: number } | null,
): number {
  const n = service?.licenseExpiryWarnMonths;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_LICENSE_WARN_MONTHS;
  return Math.min(6, Math.max(1, Math.round(n)));
}

export function licenseWarnMonthsForOrder(
  order: Pick<Order, "serviceId">,
  services: Array<{ id: string; licenseExpiryWarnMonths?: number }>,
): number {
  return licenseWarnMonthsOf(services.find((s) => s.id === order.serviceId));
}

/** DNY + YY + MM + seq (vd DNY260856). */
export function nextDossierNumber(orders: Order[], from = new Date()): string {
  const yy = String(from.getFullYear()).slice(-2);
  const mm = String(from.getMonth() + 1).padStart(2, "0");
  const prefix = `DNY${yy}${mm}`;
  let max = 0;
  for (const o of orders) {
    if (!o.orderNumber.startsWith(prefix)) continue;
    const seq = Number(o.orderNumber.slice(prefix.length));
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

export function deadlineFromService(processingDays: number, from = new Date()): string {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + Math.max(0, Math.round(processingDays) || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nextContractNumber(orders: Order[]): number {
  let max = 0;
  for (const o of orders) {
    if (typeof o.contractNumber === "number" && o.contractNumber > max) {
      max = o.contractNumber;
    }
  }
  return max + 1;
}

export function isContractNumberTaken(
  orders: Order[],
  contractNumber: number,
  excludeOrderId?: string,
): boolean {
  return orders.some(
    (o) =>
      o.id !== excludeOrderId &&
      typeof o.contractNumber === "number" &&
      o.contractNumber === contractNumber,
  );
}

export type LicenseExpiryTone = "expired" | "expiring" | "ok" | "none";

export type LicenseExpirySummary = {
  tone: LicenseExpiryTone;
  label: string;
  earliestExpiresAt?: string;
};

/** Earliest non-deleted license expiry for tags / alerts. */
export function getOrderLicenseExpirySummary(
  order: Pick<Order, "licenseAttachments">,
  warnMonths = 2,
): LicenseExpirySummary {
  const dates = (order.licenseAttachments ?? [])
    .filter((a) => !a.deleted && a.expiresAt)
    .map((a) => a.expiresAt as string)
    .sort();

  if (dates.length === 0) {
    return { tone: "none", label: tt("license.none") };
  }

  const earliest = dates[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${earliest}T00:00:00`);
  if (Number.isNaN(exp.getTime())) {
    return { tone: "none", label: tt("license.none") };
  }

  if (exp.getTime() < today.getTime()) {
    return { tone: "expired", label: tt("license.expired"), earliestExpiresAt: earliest };
  }

  const warnUntil = new Date(today);
  warnUntil.setMonth(warnUntil.getMonth() + warnMonths);
  if (exp.getTime() <= warnUntil.getTime()) {
    return { tone: "expiring", label: tt("license.expiring"), earliestExpiresAt: earliest };
  }

  return { tone: "ok", label: tt("license.ok"), earliestExpiresAt: earliest };
}

export function licenseExpiryTagColor(tone: LicenseExpiryTone): string {
  if (tone === "expired") return "error";
  if (tone === "expiring") return "warning";
  if (tone === "ok") return "success";
  return "default";
}

export function monthsUntil(dateIso: string, from = new Date()): number {
  const target = new Date(`${dateIso}T00:00:00`);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const ms = target.getTime() - start.getTime();
  return ms / (1000 * 60 * 60 * 24 * 30.44);
}

export function daysUntil(dateIso: string, from = new Date()): number {
  const target = new Date(`${dateIso}T00:00:00`);
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function normalizeOrder(o: Order): Order {
  return {
    ...o,
    needsVat: o.needsVat ?? false,
    licenseAttachments: (o.licenseAttachments ?? []).map((a: OrderAttachment) => ({ ...a })),
    approvalHistory: o.approvalHistory ?? [],
    attachments: o.attachments ?? [],
  };
}
