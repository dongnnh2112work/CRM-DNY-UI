import { num } from "@/lib/http/message";
import type { Order, PaymentInstallment, PaymentRecord, PaymentStatus } from "@/lib/types";
import type { ApiPayment } from "@/modules/payments/api";

function installmentStatus(p: ApiPayment): PaymentInstallment["status"] {
  if (p.verificationStatus === "VERIFIED") return "paid";
  if (p.verificationStatus === "VOIDED") return "pending";
  return "pending";
}

export function mapPaymentsToRecords(orders: Order[], payments: ApiPayment[]): PaymentRecord[] {
  const byOrder = new Map<string, ApiPayment[]>();
  for (const p of payments) {
    const list = byOrder.get(p.orderId) ?? [];
    list.push(p);
    byOrder.set(p.orderId, list);
  }

  return orders.map((order) => {
    const rows = byOrder.get(order.id) ?? [];
    const totalAmount = order.channel === "ctv" && order.ctvPrice != null ? order.ctvPrice : order.value;
    const installments: PaymentInstallment[] = rows
      .filter((p) => p.verificationStatus !== "VOIDED")
      .map((p) => ({
        id: p.id,
        amount: num(p.amount),
        dueDate: p.recordedAt.slice(0, 10),
        paidDate: p.verificationStatus === "VERIFIED" ? p.recordedAt.slice(0, 10) : undefined,
        method: p.method,
        status: installmentStatus(p),
      }));
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
