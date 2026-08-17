/* ── Custom Field Engine ─────────────────────────────────────────── */

import { ds } from "./design-tokens";

export type FieldType = "text" | "number" | "date" | "select" | "checkbox";

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[]; // for select type
  order: number;
  visible: boolean;
}

/* ── User & RBAC ────────────────────────────────────────────────── */

/** Built-in role keys (cannot delete). Custom roles use free-form string keys. */
export type BuiltInUserRole = "super_admin" | "admin" | "staff" | "accountant" | "ctv_role";

/** Role key — built-in or custom (e.g. `custom_sales_lead`) */
export type UserRole = BuiltInUserRole | (string & {});

export type UserStatus = "active" | "inactive";

export interface RoleDefinition {
  key: string;
  label: string;
  /** System roles cannot be deleted */
  builtin: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  address?: string;
  role: UserRole;
  status: UserStatus;
  authMethod: "google" | "email";
  avatar?: string;
  createdAt: string;
  /**
   * Special-case override: when true, `customPermissions` is used instead of the role matrix.
   */
  useCustomPermissions?: boolean;
  customPermissions?: RolePagePermissions;
}

export const BUILT_IN_ROLES: RoleDefinition[] = [
  { key: "super_admin", label: "Siêu quản trị", builtin: true },
  { key: "admin", label: "Quản trị", builtin: true },
  { key: "staff", label: "Nhân viên", builtin: true },
  { key: "accountant", label: "Kế toán", builtin: true },
  { key: "ctv_role", label: "CTV", builtin: true },
];

/** @deprecated Prefer RoleDefinition list from users-store; kept for built-in lookups */
export const ROLE_LABELS: Record<BuiltInUserRole, string> = {
  super_admin: "Siêu quản trị",
  admin: "Quản trị",
  staff: "Nhân viên",
  accountant: "Kế toán",
  ctv_role: "CTV",
};

/** Pages in the CRM menu — used for View/Edit permission matrix */
export const SYSTEM_PAGES = [
  { key: "dashboard", label: "Tổng quan" },
  { key: "orders", label: "Quản lý đơn hàng" },
  { key: "customers", label: "Quản lý khách hàng" },
  { key: "payments", label: "Quản lý thanh toán" },
  { key: "expense_approvals", label: "Duyệt chi" },
  { key: "vat", label: "Quản lý VAT" },
  { key: "services", label: "Quản lý dịch vụ" },
  { key: "emails", label: "Quản lý email" },
  { key: "users", label: "Quản lý người dùng" },
  { key: "config", label: "Cấu hình" },
  { key: "order_statuses", label: "Giai đoạn đơn" },
] as const;

export type SystemPageKey = (typeof SYSTEM_PAGES)[number]["key"];

export type PageAccess = { view: boolean; edit: boolean };

export type RolePagePermissions = Record<SystemPageKey, PageAccess>;

export function emptyPagePermissions(): RolePagePermissions {
  return Object.fromEntries(
    SYSTEM_PAGES.map((p) => [p.key, { view: false, edit: false }]),
  ) as RolePagePermissions;
}

export function fullPagePermissions(): RolePagePermissions {
  return Object.fromEntries(
    SYSTEM_PAGES.map((p) => [p.key, { view: true, edit: true }]),
  ) as RolePagePermissions;
}

/** Fill missing page keys (e.g. after adding Duyệt chi to SYSTEM_PAGES). */
export function normalizePagePermissions(
  partial?: Partial<RolePagePermissions> | null,
): RolePagePermissions {
  return { ...emptyPagePermissions(), ...(partial ?? {}) };
}

function access(pages: Partial<Record<SystemPageKey, PageAccess>>): RolePagePermissions {
  return { ...emptyPagePermissions(), ...pages };
}

/** Default View/Edit matrix for built-in roles (editable in Users UI) */
export const DEFAULT_ROLE_PAGE_PERMISSIONS: Record<string, RolePagePermissions> = {
  super_admin: fullPagePermissions(),
  admin: {
    ...fullPagePermissions(),
    /** Chỉ super_admin được sửa nhãn/màu trạng thái đơn */
    order_statuses: { view: false, edit: false },
  },
  staff: access({
    dashboard: { view: true, edit: false },
    orders: { view: true, edit: true },
    customers: { view: true, edit: true },
    payments: { view: true, edit: false },
    services: { view: true, edit: false },
    emails: { view: true, edit: false },
  }),
  accountant: access({
    dashboard: { view: true, edit: false },
    payments: { view: true, edit: true },
    expense_approvals: { view: true, edit: true },
    vat: { view: true, edit: true },
  }),
  ctv_role: access({
    dashboard: { view: true, edit: false },
    orders: { view: true, edit: false },
  }),
};

export function slugifyRoleKey(label: string): string {
  const base = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  return base ? `custom_${base}` : `custom_${Date.now()}`;
}

/* ── Customer ───────────────────────────────────────────────────── */

export type CustomerStatus = string;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  company?: string;
  taxCode?: string;
  address?: string;
  owner: string;
  status: CustomerStatus;
  createdAt: string;
  /** Dịch vụ ghi nhận thủ công (union với dịch vụ từ đơn hàng khi hiển thị). */
  usedServiceIds?: string[];
  customFields: Record<string, unknown>;
}

/* ── Service ────────────────────────────────────────────────────── */

export type ServiceStatus = "active" | "inactive";

export interface Service {
  id: string;
  name: string;
  code: string;
  category: string;
  unitPrice: number;
  processingDays: number;
  status: ServiceStatus;
  customFields: Record<string, unknown>;
}

/* ── Order ──────────────────────────────────────────────────────── */

/** Built-in + custom stage keys (custom = free string) */
export type OrderStage = string;

/** Default workflow stages — seed for order-status-store */
export const ORDER_STAGES: { key: OrderStage; label: string; color: string }[] = [
  { key: "new", label: "Mới", color: "processing" },
  { key: "processing", label: "Đang xử lý", color: "warning" },
  { key: "waiting_customer", label: "Chờ khách", color: "processing" },
  { key: "waiting_gov", label: "Chờ cơ quan", color: "warning" },
  { key: "completed", label: "Hoàn thành", color: "success" },
  { key: "cancelled", label: "Đã hủy", color: "default" },
];

/** Hex fills for charts (Recharts Cell) — from design-tokens; custom stages use store color */
export const ORDER_STAGE_CHART_COLORS: Record<string, string> = {
  new: ds.primary,
  processing: ds.accentOrange,
  waiting_customer: ds.accentTeal,
  waiting_gov: ds.accentSky,
  completed: ds.accentGreen,
  cancelled: ds.inkFaint,
};

export type OrderChannel = "direct" | "website" | "referral" | "ctv";

export type AttachmentType = "pdf" | "word" | "excel" | "other";

export interface OrderAttachment {
  id: string;
  name: string;
  type: AttachmentType;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  deleted?: boolean;
  /** Ngày cấp giấy phép (license files) */
  issuedAt?: string;
  /** Ngày hết hạn giấy phép (license files) */
  expiresAt?: string;
}

export type ApprovalStatus = "none" | "pending_review" | "approved" | "rejected";

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  none: "Không",
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
};

export interface OrderApprovalRequest {
  id: string;
  fromStage: OrderStage;
  toStage: OrderStage;
  requestedBy: string;
  requestedAt: string;
  note?: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  serviceId: string;
  serviceName: string;
  stage: OrderStage;
  channel: OrderChannel;
  ctvId?: string;
  ctvName?: string;
  /** Giá trị niêm yết */
  value: number;
  /** Giá CTV — Hoa hồng = ctvPrice - value (giá niêm yết) */
  ctvPrice?: number;
  assignedUserId: string;
  assignedUserName: string;
  submitterId: string;
  submitterName: string;
  /** Optional — used for expense approval */
  reviewerId?: string;
  reviewerName?: string;
  /** Hồ sơ làm việc trong quá trình xử lý */
  attachments: OrderAttachment[];
  /** File giấy phép / văn bản được cấp phép — lưu final, tách khỏi hồ sơ làm việc */
  licenseAttachments: OrderAttachment[];
  approvalStatus: ApprovalStatus;
  pendingTransition?: { toStage: OrderStage; requestId: string };
  approvalHistory: OrderApprovalRequest[];
  notes?: string;
  createdAt: string;
  month: string; // YYYY-MM for filtering
  /** Đơn có xuất hóa đơn VAT */
  needsVat: boolean;
  /** Số hợp đồng (tự nhiên, unique) — chỉ khi needsVat */
  contractNumber?: number;
  /** Hạn xử lý đơn */
  deadline?: string;
  /** Hạn xuất hóa đơn VAT — khi needsVat */
  vatIssueDeadline?: string;
}

/* ── Order expense (duyệt chi) ───────────────────────────────────── */

export type OrderExpenseStatus = "pending" | "approved" | "rejected";

export interface OrderExpense {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  title: string;
  note?: string;
  requestedById: string;
  requestedByName: string;
  requestedAt: string;
  status: OrderExpenseStatus;
  reviewedById?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNote?: string;
}

/* ── App notifications ──────────────────────────────────────────── */

export type AppNotificationType =
  | "task_assigned"
  | "order_overdue"
  | "license_expiring"
  | "vat_deadline_approaching"
  | "expense_pending"
  | "expense_reviewed";

export interface AppNotification {
  id: string;
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  href?: string;
  orderId?: string;
  read: boolean;
  createdAt: string;
  /** Dedupe key e.g. license_expiring:o1:2026-08-13 */
  dedupeKey?: string;
}

/* ── Payment ────────────────────────────────────────────────────── */

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export interface PaymentInstallment {
  id: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  method?: string;
  status: "pending" | "paid" | "overdue";
  note?: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  status: PaymentStatus;
  installments: PaymentInstallment[];
}

/* ── VAT Invoice ────────────────────────────────────────────────── */

export type VatStatus = "draft" | "issued" | "cancelled";

export interface VatInvoiceLine {
  description: string;
  amount: number;
}

export interface VatInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  /** Số HĐ (hợp đồng) lấy từ đơn — hiển thị trên list */
  contractNumber?: number;
  customerName: string;
  taxCode?: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  status: VatStatus;
  lines: VatInvoiceLine[];
}

/* ── CTV ────────────────────────────────────────────────────────── */

export type CtvStatus = "active" | "inactive";

export interface CtvJob {
  orderId: string;
  orderNumber: string;
  customerName: string;
  serviceName: string;
  ratecard: number;
  ctvPrice: number;
  commission: number;
}

export interface Ctv {
  id: string;
  name: string;
  phone: string;
  email: string;
  status: CtvStatus;
  totalJobs: number;
  totalCommission: number;
  jobs: CtvJob[];
}

/* ── Email ──────────────────────────────────────────────────────── */

export type EmailStatus = "draft" | "sent" | "scheduled" | "failed";

export interface EmailRecord {
  id: string;
  subject: string;
  recipients: string[];
  recipientCount: number;
  status: EmailStatus;
  sentAt?: string;
  scheduledAt?: string;
  body: string;
}

/* ── Dashboard ──────────────────────────────────────────────────── */

export interface DashboardMetrics {
  revenue: { total: number; thisMonth: number; byMonth: { month: string; value: number }[] };
  orders: { total: number; thisMonth: number; byStatus: { status: string; count: number }[] };
  customers: { total: number; newThisMonth: number };
  commission: { totalPaid: number };
}
