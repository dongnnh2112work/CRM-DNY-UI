import type { Order, PaymentRecord } from "@/lib/types";

function linkedOrders(payment: PaymentRecord, orders: Order[]): Order[] {
  const ids = payment.groupedOrderIds?.length ? payment.groupedOrderIds : [payment.orderId];
  return ids
    .map((id) => orders.find((order) => order.id === id))
    .filter((order): order is Order => order != null);
}

/**
 * Hợp đồng mà mọi đơn đã hủy (hoặc đúng một đơn và đơn đó đã hủy).
 * Không có đơn trong bộ nhớ thì không giấu — tránh nuốt dòng mồ côi.
 */
export function isCancelledOnlyPayment(payment: PaymentRecord, orders: Order[]): boolean {
  const linked = linkedOrders(payment, orders);
  if (linked.length === 0) return false;
  return linked.every((order) => order.stage === "cancelled");
}

/** Danh sách /payments: không hiện nhóm đã hủy như khoản chưa thu. */
export function paymentsForCollection(payments: PaymentRecord[], orders: Order[]): PaymentRecord[] {
  return payments.filter((payment) => !isCancelledOnlyPayment(payment, orders));
}

/** Dashboard “Thanh toán sắp tới”: bỏ nhóm đã hủy và các dòng đã thu đủ. */
export function upcomingCollectionPayments(payments: PaymentRecord[], orders: Order[]): PaymentRecord[] {
  return paymentsForCollection(payments, orders).filter((payment) => payment.status !== "paid");
}
