import {
  buildOrderCashflow,
  cashflowForMonth,
  currentYearMonth,
  yearMonthOf,
  type OrderCashflow,
} from "@/lib/order-cashflow";
import type { Order, OrderExpense, PaymentRecord, RolePagePermissions } from "@/lib/types";

/** `edit` = BOD / admin / kế toán xem cả công ty. `view` (hoặc role staff) = chỉ lương của mình. */
export type PayrollScope = "all" | "self" | "none";

export function getPayrollScope(
  user: { role: string } | null | undefined,
  perms: RolePagePermissions | null | undefined,
): PayrollScope {
  if (!user) return "none";
  if (perms?.payroll?.edit) return "all";
  if (perms?.payroll?.view || user.role === "staff") return "self";
  return "none";
}

export type PayrollLine = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  serviceName: string;
  thu: number;
  chi: number;
  net: number;
  commissionPercent: number;
  salary: number;
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

export function orderSalary(percent: number | undefined, net: number): number {
  const p = typeof percent === "number" && Number.isFinite(percent) ? percent : 0;
  return (p / 100) * net;
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

export function buildPayroll(
  orders: Order[],
  payments: PaymentRecord[],
  expenses: OrderExpense[],
  month: string,
): StaffPayroll[] {
  const payByOrder = new Map(payments.map((p) => [p.orderId, p]));
  const expByOrder = new Map<string, OrderExpense[]>();
  for (const e of expenses) {
    if (!e.orderId) continue;
    const list = expByOrder.get(e.orderId) ?? [];
    list.push(e);
    expByOrder.set(e.orderId, list);
  }

  const byStaff = new Map<string, StaffPayroll>();

  for (const order of orders) {
    if (order.stage === "cancelled") continue;
    const flow = buildOrderCashflow(payByOrder.get(order.id), expByOrder.get(order.id) ?? []);
    const row = cashflowForMonth(flow, month);
    if (row.thu === 0 && row.chi === 0) continue;

    const net = row.thu - row.chi;
    const commissionPercent = order.commissionPercent ?? 0;
    const line: PayrollLine = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      serviceName: order.serviceName,
      thu: row.thu,
      chi: row.chi,
      net,
      commissionPercent,
      salary: orderSalary(commissionPercent, net),
    };

    const current = byStaff.get(order.assignedUserId) ?? {
      userId: order.assignedUserId,
      userName: order.assignedUserName,
      orderCount: 0,
      total: 0,
      lines: [],
    };
    current.lines.push(line);
    current.total += line.salary;
    current.orderCount = current.lines.length;
    byStaff.set(order.assignedUserId, current);
  }

  return [...byStaff.values()].sort((a, b) => a.userName.localeCompare(b.userName, "vi"));
}
