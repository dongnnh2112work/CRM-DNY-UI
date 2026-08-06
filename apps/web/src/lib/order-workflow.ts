import type { AppUser, Order, OrderStage, UserRole } from "./types";

/**
 * Toggle later when business rules change.
 * - true  = every stage change needs reviewer approval
 * - false = free drag (except when a pending request exists)
 */
export const STAGE_TRANSITION_REQUIRES_APPROVAL = true;

/** Stages that still require approval even if STAGE_TRANSITION_REQUIRES_APPROVAL is false */
export const ALWAYS_GATED_STAGES: OrderStage[] = ["completed", "cancelled"];

const OVERRIDE_ROLES: UserRole[] = ["super_admin", "admin"];

export function requiresApprovalForTransition(_from: OrderStage, to: OrderStage): boolean {
  if (STAGE_TRANSITION_REQUIRES_APPROVAL) return true;
  return ALWAYS_GATED_STAGES.includes(to);
}

export function canRequestTransition(order: Order, actorId: string): boolean {
  if (order.approvalStatus === "pending_review") return false;
  return actorId === order.submitterId || actorId === order.assignedUserId;
}

export function canApprove(order: Order, actor: Pick<AppUser, "id" | "role">): boolean {
  if (order.approvalStatus !== "pending_review") return false;
  if (actor.id === order.reviewerId) return true;
  return OVERRIDE_ROLES.includes(actor.role);
}

export function isTransitionAllowed(order: Order, toStage: OrderStage): boolean {
  if (order.stage === toStage) return true;
  if (!requiresApprovalForTransition(order.stage, toStage)) {
    return order.approvalStatus !== "pending_review";
  }
  if (
    order.approvalStatus === "approved" &&
    order.pendingTransition?.toStage === toStage
  ) {
    return true;
  }
  return false;
}

/** Có file giấy phép final (tách khỏi hồ sơ làm việc) */
export function hasLicenseDocument(order: Pick<Order, "licenseAttachments">): boolean {
  return (order.licenseAttachments ?? []).some((a) => !a.deleted);
}

export function requiresLicenseForStage(toStage: OrderStage): boolean {
  return toStage === "completed";
}

export function canMoveToCompleted(order: Pick<Order, "licenseAttachments">): boolean {
  return hasLicenseDocument(order);
}

export function getLicenseBlockMessage(): string {
  return "Chuyển sang Hoàn thành bắt buộc tải lên file giấy phép / văn bản được cấp phép ở ô upload riêng.";
}

export function getAttachmentType(filename: string): "pdf" | "word" | "excel" | "other" {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "doc" || ext === "docx") return "word";
  if (ext === "xls" || ext === "xlsx") return "excel";
  return "other";
}

export const ACCEPT_FILE_TYPES =
  ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
