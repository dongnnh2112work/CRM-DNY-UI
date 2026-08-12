/**
 * Central status → label/color mapping for CRM badges.
 * Rule tones: success | warning | danger(error) | info(processing) | neutral(default)
 */

export type StatusTone = "success" | "warning" | "error" | "processing" | "default";

export type StatusModule =
  | "customer"
  | "payment"
  | "paymentInstallment"
  | "email"
  | "vat"
  | "user"
  | "ctv"
  | "service"
  | "approval"
  | "approvalRequest"
  | "orderStage";

export interface StatusMeta {
  label: string;
  color: StatusTone;
}

export const STATUS_CONFIG: Record<StatusModule, Record<string, StatusMeta>> = {
  customer: {
    active: { label: "Hoạt động", color: "success" },
    lead: { label: "Tiềm năng", color: "processing" },
    archived: { label: "Lưu trữ", color: "default" },
  },
  payment: {
    unpaid: { label: "Chưa TT", color: "default" },
    partial: { label: "Một phần", color: "warning" },
    paid: { label: "Đã TT", color: "success" },
    overdue: { label: "Quá hạn", color: "error" },
  },
  paymentInstallment: {
    pending: { label: "Chờ", color: "warning" },
    paid: { label: "Đã TT", color: "success" },
    overdue: { label: "Quá hạn", color: "error" },
  },
  email: {
    draft: { label: "Nháp", color: "default" },
    scheduled: { label: "Đã lên lịch", color: "processing" },
    sent: { label: "Đã gửi", color: "success" },
    failed: { label: "Thất bại", color: "error" },
  },
  vat: {
    draft: { label: "Nháp", color: "default" },
    issued: { label: "Đã xuất", color: "success" },
    cancelled: { label: "Đã hủy", color: "error" },
  },
  user: {
    active: { label: "Hoạt động", color: "success" },
    inactive: { label: "Ngừng", color: "default" },
  },
  ctv: {
    active: { label: "Hoạt động", color: "success" },
    inactive: { label: "Ngừng", color: "default" },
  },
  service: {
    active: { label: "Hoạt động", color: "success" },
    inactive: { label: "Ngừng", color: "default" },
  },
  approval: {
    none: { label: "Không", color: "default" },
    pending_review: { label: "Chờ duyệt", color: "processing" },
    approved: { label: "Đã duyệt", color: "success" },
    rejected: { label: "Từ chối", color: "error" },
  },
  approvalRequest: {
    pending: { label: "Chờ", color: "processing" },
    approved: { label: "Đã duyệt", color: "success" },
    rejected: { label: "Từ chối", color: "error" },
  },
  orderStage: {
    new: { label: "Mới", color: "processing" },
    processing: { label: "Đang xử lý", color: "warning" },
    waiting_customer: { label: "Chờ khách", color: "processing" },
    waiting_gov: { label: "Chờ cơ quan", color: "warning" },
    completed: { label: "Hoàn thành", color: "success" },
    cancelled: { label: "Đã hủy", color: "default" },
  },
};

export function getStatusMeta(module: StatusModule, status: string): StatusMeta {
  return STATUS_CONFIG[module][status] ?? { label: status, color: "default" };
}

export function getStatusOptions(module: StatusModule): { value: string; label: string }[] {
  return Object.entries(STATUS_CONFIG[module]).map(([value, meta]) => ({
    value,
    label: meta.label,
  }));
}
