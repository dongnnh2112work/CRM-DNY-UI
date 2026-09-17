import { num } from "@/lib/http/message";
import {
  groupContractTotal,
  groupOrdersByContract,
  pickPrimaryOrder,
  recalcPayment,
} from "@/lib/order-group";
import type { Order, PaymentInstallment, PaymentRecord } from "@/lib/types";
import type { ApiPayment } from "@/modules/payments/api";
import type { ApiScheduleLine } from "@/modules/orders/api";

function installmentStatus(p: ApiPayment): PaymentInstallment["status"] {
  if (p.verificationStatus === "VERIFIED") return "paid";
  if (p.verificationStatus === "VOIDED") return "pending";
  return "pending";
}

export function unwrapSchedule(
  data: { items?: ApiScheduleLine[] } | ApiScheduleLine[] | undefined | null,
): ApiScheduleLine[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

function installmentsForOrders(
  group: Order[],
  paymentsByOrder: Map<string, ApiPayment[]>,
  schedules: Map<string, ApiScheduleLine[]>,
): PaymentInstallment[] {
  const usedPayment = new Set<string>();
  const installments: PaymentInstallment[] = [];
  const createdAt = group[0]?.createdAt ?? "";

  for (const order of group) {
    const rows = (paymentsByOrder.get(order.id) ?? []).filter((p) => p.verificationStatus !== "VOIDED");
    const lines = [...(schedules.get(order.id) ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );

    for (const line of lines) {
      const pay = rows.find((p) => p.scheduleLineId && p.scheduleLineId === line.id);
      if (pay) usedPayment.add(pay.id);
      const due = (line.dueDate ?? pay?.recordedAt ?? createdAt).slice(0, 10);
      installments.push({
        id: pay?.id ?? line.id ?? `sch-${order.id}-${line.sortOrder ?? installments.length}`,
        amount: num(line.amount ?? pay?.amount),
        dueDate: due,
        paidDate: pay?.verificationStatus === "VERIFIED" ? pay.recordedAt.slice(0, 10) : undefined,
        method: pay?.method,
        status: pay ? installmentStatus(pay) : "pending",
      });
    }

    for (const p of rows) {
      if (usedPayment.has(p.id)) continue;
      usedPayment.add(p.id);
      installments.push({
        id: p.id,
        amount: num(p.amount),
        dueDate: p.recordedAt.slice(0, 10),
        paidDate: p.verificationStatus === "VERIFIED" ? p.recordedAt.slice(0, 10) : undefined,
        method: p.method,
        status: installmentStatus(p),
      });
    }
  }

  return installments;
}

export function mapPaymentsToRecords(
  orders: Order[],
  payments: ApiPayment[],
  schedules: Map<string, ApiScheduleLine[]> = new Map(),
): PaymentRecord[] {
  const byOrder = new Map<string, ApiPayment[]>();
  for (const p of payments) {
    const list = byOrder.get(p.orderId) ?? [];
    list.push(p);
    byOrder.set(p.orderId, list);
  }

  return groupOrdersByContract(orders).map((group) => {
    const primary = pickPrimaryOrder(group);
    const installments = installmentsForOrders(group, byOrder, schedules);
    return recalcPayment({
      id: `pay-${primary.id}`,
      orderId: primary.id,
      orderNumber: primary.orderNumber,
      customerId: primary.customerId,
      customerName: primary.customerName,
      totalAmount: groupContractTotal(group),
      paidAmount: 0,
      remaining: 0,
      status: "unpaid",
      installments,
      groupedOrderIds: group.map((o) => o.id),
    });
  });
}
