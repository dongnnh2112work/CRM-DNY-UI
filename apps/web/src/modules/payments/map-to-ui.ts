import { num } from "@/lib/http/message";
import type { Order, PaymentInstallment, PaymentRecord, PaymentStatus } from "@/lib/types";
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

  return orders.map((order) => {
    const rows = (byOrder.get(order.id) ?? []).filter((p) => p.verificationStatus !== "VOIDED");
    const lines = [...(schedules.get(order.id) ?? [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    );
    const usedPayment = new Set<string>();
    const installments: PaymentInstallment[] = [];

    for (const line of lines) {
      const pay = rows.find((p) => p.scheduleLineId && p.scheduleLineId === line.id);
      if (pay) usedPayment.add(pay.id);
      const due = (line.dueDate ?? pay?.recordedAt ?? order.createdAt).slice(0, 10);
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
      installments.push({
        id: p.id,
        amount: num(p.amount),
        dueDate: p.recordedAt.slice(0, 10),
        paidDate: p.verificationStatus === "VERIFIED" ? p.recordedAt.slice(0, 10) : undefined,
        method: p.method,
        status: installmentStatus(p),
      });
    }

    const totalAmount = order.value;
    const paidAmount = installments.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
    const remaining = Math.max(0, totalAmount - paidAmount);
    let status: PaymentStatus = "unpaid";
    if (paidAmount >= totalAmount && totalAmount > 0) status = "paid";
    else if (paidAmount > 0) status = "partial";
    return {
      id: `pay-${order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      totalAmount,
      paidAmount,
      remaining,
      status,
      installments,
    };
  });
}
