import { num } from "@/lib/http/message";
import type { ApprovalStatus, Order, OrderChannel } from "@/lib/types";
import type { ApiOrder } from "@/modules/orders/api";

const CHANNELS = new Set(["direct", "website", "referral", "ctv"]);

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
  const created = o.createdAt.slice(0, 10);
  const vatRate = num(o.vatRate);
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    contractId: o.contractId,
    customerId: o.customerId,
    customerName: names.customerName ?? o.customerId,
    serviceId: o.serviceId,
    serviceName: names.serviceName ?? o.serviceId,
    stage: o.stage || "new",
    channel: mapChannel(o.channel),
    ctvId: o.collaboratorId ?? undefined,
    ctvName: names.ctvName,
    value: num(o.value),
    ctvPrice: o.collaboratorPrice != null ? num(o.collaboratorPrice) : undefined,
    assignedUserId: o.assignedUserId,
    assignedUserName: names.assignedUserName ?? o.assignedUserId,
    submitterId: o.submitterUserId,
    submitterName: names.submitterName ?? o.submitterUserId,
    reviewerId: o.reviewerUserId ?? undefined,
    reviewerName: names.reviewerName,
    attachments: [],
    licenseAttachments: [],
    approvalStatus: mapApproval(o.approvalStatus),
    approvalHistory: [],
    notes: o.notes ?? undefined,
    createdAt: created,
    month: created.slice(0, 7),
    needsVat: vatRate > 0 && num(o.totalGross) > num(o.totalNet),
    contractNumber: names.contractNumber,
  };
}
