import { num } from "@/lib/http/message";
import { entityDisplayName, normalizeCommissionPercent } from "@/lib/order-helpers";
import type { ApprovalStatus, Order, OrderChannel } from "@/lib/types";
import type { ApiOrder, CreateOrderBody, UpdateOrderBody } from "@/modules/orders/api";

const CHANNELS = new Set(["direct", "website", "referral", "ctv"]);

function optionalName(...candidates: Array<string | null | undefined>) {
  const label = entityDisplayName(...candidates);
  return label === "—" ? undefined : label;
}

function mapChannel(channel: string | undefined): OrderChannel {
  const c = (channel ?? "").toLowerCase();
  return CHANNELS.has(c) ? (c as OrderChannel) : "direct";
}

function mapApproval(status: string | undefined): ApprovalStatus {
  const s = (status ?? "").toLowerCase();
  if (s === "approved") return "approved";
  if (s === "rejected") return "rejected";
  if (s.includes("pending")) return "pending_review";
  return "none";
}

/** `YYYY-MM-DD` from a date or ISO datetime. Empty / invalid → undefined. */
function mapDeadline(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const day = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}

function mapZaloUrl(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const text = value?.trim();
    if (text) return text;
  }
  return undefined;
}

/** Trimmed value, or null. Never an empty string (BE rejects ""). */
function nullableText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

export function mapApiOrderToUi(
  o: ApiOrder,
  names: {
    customerName?: string;
    serviceName?: string;
    assignedUserName?: string;
    submitterName?: string;
    reviewerName?: string;
    ctvName?: string;
    contractNumber?: number;
  } = {},
): Order {
  const created = typeof o.createdAt === "string" ? o.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  const vatRate = num(o.vatRate);
  return {
    id: o.id,
    orderNumber: o.orderNumber || o.id,
    contractId: o.contractId,
    customerId: o.customerId,
    // Prefer API JOIN / catalog name — never store raw UUID as the display name.
    customerName: entityDisplayName(names.customerName, o.customerName),
    serviceId: o.serviceId,
    serviceName: entityDisplayName(names.serviceName, o.serviceName),
    stage: o.stage || "new",
    channel: mapChannel(o.channel),
    ctvId: o.collaboratorId ?? undefined,
    ctvName: optionalName(names.ctvName, o.collaboratorName),
    value: num(o.value),
    ctvPrice: o.collaboratorPrice != null ? num(o.collaboratorPrice) : undefined,
    assignedUserId: o.assignedUserId,
    assignedUserName: entityDisplayName(names.assignedUserName, o.assignedUserName),
    submitterId: o.submitterUserId,
    submitterName: entityDisplayName(names.submitterName, o.submitterName),
    reviewerId: o.reviewerUserId ?? undefined,
    reviewerName: o.reviewerUserId ? optionalName(names.reviewerName, o.reviewerName) : undefined,
    attachments: [],
    licenseAttachments: [],
    approvalStatus: mapApproval(o.approvalStatus),
    approvalHistory: [],
    notes: o.notes ?? undefined,
    createdAt: created,
    month: created.slice(0, 7),
    needsVat: vatRate > 0 && num(o.totalGross) > num(o.totalNet),
    contractNumber: names.contractNumber,
    commissionPercent: normalizeCommissionPercent(o.commissionPercent),
    deadline: mapDeadline(o.deadline),
    zaloGroupUrl: mapZaloUrl(o.zaloGroupUrl, o.zaloGroupLink),
  };
}

export function mapUiOrderToCreateApi(input: {
  orderNumber: string;
  contractId: string;
  customerId: string;
  serviceId: string;
  value: number;
  assignedUserId: string;
  submitterUserId?: string;
  collaboratorId?: string;
  vatRate?: number;
  stage?: string;
  notes?: string;
  commissionPercent?: number | null;
}): CreateOrderBody {
  const vatRate = input.vatRate ?? 0;
  const value = input.value;
  const commissionPercent = normalizeCommissionPercent(input.commissionPercent);
  return {
    orderNumber: input.orderNumber,
    contractId: input.contractId,
    customerId: input.customerId,
    serviceId: input.serviceId,
    value,
    totalNet: value,
    totalGross: vatRate ? Math.round(value * (1 + vatRate / 100)) : value,
    assignedUserId: input.assignedUserId,
    submitterUserId: input.submitterUserId,
    collaboratorId: input.collaboratorId,
    vatRate,
    stage: input.stage ?? "new",
    notes: input.notes,
    ...(commissionPercent != null ? { commissionPercent } : {}),
  };
}

export function mapUiOrderToUpdateApi(input: {
  value: number;
  vatRate?: number;
  channel?: string;
  collaboratorId?: string | null;
  notes?: string | null;
  /** `null` xóa %; `undefined` không đụng field */
  commissionPercent?: number | null;
  customerId?: string;
  serviceId?: string;
  submitterUserId?: string;
  /** `null` xóa hạn; `undefined` không đụng field */
  deadline?: string | null;
  /** `null` xóa link; `undefined` không đụng field. Chuỗi rỗng được gửi thành null. */
  zaloGroupUrl?: string | null;
}): UpdateOrderBody {
  const vatRate = input.vatRate ?? 0;
  const value = input.value;
  const body: UpdateOrderBody = {
    value,
    totalNet: value,
    totalGross: vatRate ? Math.round(value * (1 + vatRate / 100)) : value,
    vatRate,
    channel: input.channel,
    collaboratorId: input.collaboratorId,
    notes: input.notes,
  };
  if (input.commissionPercent === null) {
    body.commissionPercent = null;
  } else if (input.commissionPercent !== undefined) {
    const pct = normalizeCommissionPercent(input.commissionPercent);
    if (pct != null) body.commissionPercent = pct;
  }
  if (input.customerId) body.customerId = input.customerId;
  if (input.serviceId) body.serviceId = input.serviceId;
  if (input.submitterUserId) body.submitterUserId = input.submitterUserId;
  if (input.deadline !== undefined) body.deadline = mapDeadline(input.deadline) ?? null;
  if (input.zaloGroupUrl !== undefined) body.zaloGroupUrl = nullableText(input.zaloGroupUrl);
  return body;
}
