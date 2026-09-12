import type { AuthUser } from "@/modules/auth/api";
import type { RolePagePermissions, SystemPageKey } from "@/lib/types";

/** Capability codes from Authorization.md — nguồn sự thật = GET /auth/me.permissions */
export const PERMISSION = {
  customerView: "customer.view",
  customerCreate: "customer.create",
  customerUpdate: "customer.update",
  orderView: "order.view",
  orderCreate: "order.create",
  orderUpdate: "order.update",
  orderDelete: "order.delete",
  orderAssign: "order.assign",
  orderChangeStage: "order.change_stage",
  paymentView: "payment.view",
  expenseView: "expense.view",
  expenseCreate: "expense.create",
  expenseApprove: "expense.approve",
  vatView: "vat.view",
  serviceView: "service.view",
  commissionView: "commission.view",
  userManage: "user.manage",
  roleManage: "role.manage",
  permissionManage: "permission.manage",
  configManage: "config.manage",
  documentUpload: "document.upload",
} as const;

/**
 * Permission tối thiểu để thấy menu trang (phương án A).
 * `null` = không gắn API capability (dashboard / emails / config local).
 */
export const PAGE_VIEW_PERMISSION: Record<SystemPageKey, string | null> = {
  dashboard: null,
  orders: PERMISSION.orderView,
  customers: PERMISSION.customerView,
  payments: PERMISSION.paymentView,
  expense_approvals: PERMISSION.expenseView,
  payroll: null,
  vat: PERMISSION.vatView,
  services: PERMISSION.serviceView,
  emails: null,
  users: PERMISSION.userManage,
  config: null,
  order_statuses: PERMISSION.configManage,
};

export function hasPermission(user: AuthUser | null | undefined, code: string) {
  return Boolean(user?.permissions?.includes(code));
}

/** Menu: thiếu capability API → ẩn. Matrix View=false chỉ giấu UX, không mở API. */
export function canSeeMenuPage(args: {
  page: SystemPageKey;
  apiUser: AuthUser | null | undefined;
  matrix?: RolePagePermissions | null;
}): boolean {
  const cap = PAGE_VIEW_PERMISSION[args.page];
  if (cap && args.apiUser && !hasPermission(args.apiUser, cap)) return false;
  if (args.matrix?.[args.page]?.view === false) return false;
  return true;
}

export type ExpenseReviewBlock = "ok" | "no_permission" | "no_reviewer" | "not_reviewer";

export function expenseReviewBlock(args: {
  hasExpenseApprovePermission: boolean;
  currentUserId?: string;
  reviewerId?: string;
}): ExpenseReviewBlock {
  if (!args.hasExpenseApprovePermission || !args.currentUserId) return "no_permission";
  if (!args.reviewerId) return "no_reviewer";
  if (args.reviewerId !== args.currentUserId) return "not_reviewer";
  return "ok";
}

export function canReviewExpense(args: {
  hasExpenseApprovePermission: boolean;
  currentUserId?: string;
  reviewerId?: string;
}) {
  return expenseReviewBlock(args) === "ok";
}
