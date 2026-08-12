import type { Order, OrderAttachment } from "@/lib/types";

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
    return { tone: "none", label: "Chưa có GP" };
  }

  const earliest = dates[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${earliest}T00:00:00`);
  if (Number.isNaN(exp.getTime())) {
    return { tone: "none", label: "Chưa có GP" };
  }

  if (exp.getTime() < today.getTime()) {
    return { tone: "expired", label: "Hết hạn", earliestExpiresAt: earliest };
  }

  const warnUntil = new Date(today);
  warnUntil.setMonth(warnUntil.getMonth() + warnMonths);
  if (exp.getTime() <= warnUntil.getTime()) {
    return { tone: "expiring", label: "Sắp hết hạn", earliestExpiresAt: earliest };
  }

  return { tone: "ok", label: "Còn hạn", earliestExpiresAt: earliest };
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
