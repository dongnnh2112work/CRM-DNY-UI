/* ── Custom Field Engine ─────────────────────────────────────────── */

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

export type UserRole = "super_admin" | "admin" | "staff" | "accountant" | "ctv_role";

export type UserStatus = "active" | "inactive";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  authMethod: "google" | "email";
  avatar?: string;
  createdAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Siêu quản trị",
  admin: "Quản trị",
  staff: "Nhân viên",
  accountant: "Kế toán",
  ctv_role: "CTV",
};

export const PERMISSIONS = [
  "dashboard.view",
  "orders.view",
  "orders.create",
  "orders.edit",
  "orders.delete",
  "customers.view",
  "customers.create",
  "customers.edit",
  "customers.delete",
  "customers.import",
  "payments.view",
  "payments.create",
  "payments.edit",
  "vat.view",
  "vat.create",
  "services.view",
  "services.create",
  "services.edit",
  "emails.view",
  "emails.send",
  "ctv.view",
  "ctv.edit",
  "users.view",
  "users.create",
  "users.edit",
  "config.edit",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: [...PERMISSIONS],
  admin: [...PERMISSIONS],
  staff: [
    "dashboard.view",
    "orders.view",
    "orders.create",
    "orders.edit",
    "customers.view",
    "customers.create",
    "customers.edit",
    "payments.view",
  ],
  accountant: [
    "dashboard.view",
    "payments.view",
    "payments.create",
    "payments.edit",
    "vat.view",
    "vat.create",
  ],
  ctv_role: ["dashboard.view", "orders.view", "ctv.view"],
};

/* ── Customer ───────────────────────────────────────────────────── */

export type CustomerStatus = "active" | "lead" | "archived";

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

export type OrderStage =
  | "new"
  | "processing"
  | "waiting_customer"
  | "waiting_gov"
  | "completed"
  | "cancelled";

export const ORDER_STAGES: { key: OrderStage; label: string; color: string }[] = [
  { key: "new", label: "Mới", color: "#0075de" },
  { key: "processing", label: "Đang xử lý", color: "#dd5b00" },
  { key: "waiting_customer", label: "Chờ khách", color: "#2a9d99" },
  { key: "waiting_gov", label: "Chờ cơ quan", color: "#62aef0" },
  { key: "completed", label: "Hoàn thành", color: "#1aae39" },
  { key: "cancelled", label: "Đã hủy", color: "#a39e98" },
];

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
  /** Giá trị Ratecard */
  value: number;
  /** Giá CTV — Commission = ctvPrice - value (Ratecard) */
  ctvPrice?: number;
  assignedUserId: string;
  assignedUserName: string;
  submitterId: string;
  submitterName: string;
  reviewerId: string;
  reviewerName: string;
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
}

/* ── Payment ────────────────────────────────────────────────────── */

export type PaymentStatus = "unpaid" | "partial" | "paid" | "overdue";

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Chưa TT",
  partial: "Một phần",
  paid: "Đã TT",
  overdue: "Quá hạn",
};

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

export interface VatInvoice {
  id: string;
  invoiceNumber: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  taxCode?: string;
  amount: number;
  taxRate: number;
  taxAmount: number;
  totalAmount: number;
  issueDate: string;
  status: VatStatus;
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
  commission: { totalPaid: number; topCtv: { name: string; amount: number }[] };
}
