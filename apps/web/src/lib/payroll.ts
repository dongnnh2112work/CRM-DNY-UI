import {
  buildOrderCashflow,
  cashflowForMonth,
  currentYearMonth,
  yearMonthOf,
  type OrderCashflow,
} from "@/lib/order-cashflow";
import { allocatePaymentShare, siblingOrders } from "@/lib/order-group";
import type { Order, OrderExpense, PaymentRecord, RolePagePermissions } from "@/lib/types";

/** `commission.view` (hoặc matrix payroll.edit) = cả công ty. User đã login = lương của mình. */
export type PayrollScope = "all" | "self" | "none";

export function getPayrollScope(
  user: { role: string } | null | undefined,
  perms: RolePagePermissions | null | undefined,
  apiPermissions?: string[] | null,
): PayrollScope {
  if (!user) return "none";
  if (apiPermissions?.includes("commission.view") || perms?.payroll?.edit) return "all";
  return "self";
}

export type PayrollLine = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  serviceName: string;
  thu: number;
  chi: number;
  net: number;
  /** null khi đơn chưa nhập %. Không dùng 0 im lặng. */
  commissionPercent: number | null;
  commissionMissing: boolean;
  /** null khi thiếu %. Âm giữ nguyên — không kẹp về 0. */
  salary: number | null;
};

export type StaffPayroll = {
  userId: string;
  userName: string;
  orderCount: number;
  total: number;
  lines: PayrollLine[];
};

export function monthNet(flow: OrderCashflow, month: string): number {
  const row = cashflowForMonth(flow, month);
  return row.thu - row.chi;
}

/** Thiếu % → null (UI hiện "chưa nhập %"). 0% là số đã nhập. Net âm vẫn ra lương âm. */
export function orderSalary(percent: number | null | undefined, net: number): number | null {
  if (typeof percent !== "number" || !Number.isFinite(percent)) return null;
  return Math.round((percent / 100) * net);
}

export function collectPayrollMonths(
  orders: Order[],
  payments: PaymentRecord[],
  expenses: OrderExpense[],
  extra: string[] = [currentYearMonth()],
): string[] {
  const months = new Set<string>(extra.filter(Boolean));
  for (const o of orders) {
    if (o.month) months.add(o.month);
  }
  for (const p of payments) {
    for (const i of p.installments) {
      const m = yearMonthOf(i.paidDate ?? i.dueDate);
      if (m) months.add(m);
    }
  }
  for (const e of expenses) {
    const m = yearMonthOf(e.reviewedAt ?? e.requestedAt);
    if (m) months.add(m);
  }
  return [...months].sort();
}

function staffDisplayName(
  userId: string,
  fallback?: string,
  nameById?: Map<string, string>,
): string {
  const fromMap = nameById?.get(userId);
  if (fromMap && fromMap !== userId) return fromMap;
  if (fallback && fallback !== userId) return fallback;
  return fromMap || fallback || userId;
}

export function buildPayroll(
  orders: Order[],
  payments: PaymentRecord[],
  expenses: OrderExpense[],
  month: string,
  nameById?: Map<string, string>,
): StaffPayroll[] {
  const expByOrder = new Map<string, OrderExpense[]>();
  for (const e of expenses) {
    if (!e.orderId) continue;
    const list = expByOrder.get(e.orderId) ?? [];
    list.push(e);
    expByOrder.set(e.orderId, list);
  }

  const byStaff = new Map<string, StaffPayroll>();

  for (const order of orders) {
    // Đơn hủy vẫn giữ thu đã xác minh và chi đã duyệt. Bỏ qua sẽ làm lương tăng
    // (chi rơi khỏi phiếu, thu bị dồn sang đơn còn lại).
    const siblings = siblingOrders(orders, order);
    const groupPay = payments.find(
      (p) => p.orderId === order.id || p.groupedOrderIds?.includes(order.id),
    );
    const flow = buildOrderCashflow(
      allocatePaymentShare(groupPay, order, siblings),
      expByOrder.get(order.id) ?? [],
    );
    const row = cashflowForMonth(flow, month);
    if (row.thu === 0 && row.chi === 0) continue;

    const net = row.thu - row.chi;
    const rawPercent = order.commissionPercent;
    const commissionPercent =
      typeof rawPercent === "number" && Number.isFinite(rawPercent) ? rawPercent : null;
    const commissionMissing = commissionPercent == null;
    const salary = orderSalary(commissionPercent, net);
    const line: PayrollLine = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      serviceName: order.serviceName,
      thu: row.thu,
      chi: row.chi,
      net,
      commissionPercent,
      commissionMissing,
      salary,
    };

    const displayName = staffDisplayName(order.assignedUserId, order.assignedUserName, nameById);
    const current = byStaff.get(order.assignedUserId) ?? {
      userId: order.assignedUserId,
      userName: displayName,
      orderCount: 0,
      total: 0,
      lines: [],
    };
    // Upgrade UUID placeholder when a real name arrives later in the loop / map.
    if (current.userName === current.userId && displayName !== current.userId) {
      current.userName = displayName;
    }
    current.lines.push(line);
    if (line.salary != null) current.total += line.salary;
    current.orderCount = current.lines.length;
    byStaff.set(order.assignedUserId, current);
  }

  return [...byStaff.values()].sort((a, b) => a.userName.localeCompare(b.userName, "vi"));
}
