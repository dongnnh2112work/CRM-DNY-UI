import type { Order, PaymentInstallment, PaymentRecord, PaymentStatus } from "@/lib/types";

const CHILD_SUFFIX = /-[1-9]\d*$/;

export function dossierBaseNumber(orderNumber?: string | null): string {
  return String(orderNumber ?? "").replace(CHILD_SUFFIX, "");
}

export function splitDossierNumbers(base: string, count: number): string[] {
  const n = Math.max(1, count);
  return Array.from({ length: n }, (_, i) => (i === 0 ? base : `${base}-${i}`));
}

export function orderGroupKey(order: Pick<Order, "id" | "contractId">): string {
  return order.contractId ? `contract:${order.contractId}` : `order:${order.id}`;
}

export function sameOrderGroup(
  a: Pick<Order, "id" | "contractId">,
  b: Pick<Order, "id" | "contractId">,
): boolean {
  return orderGroupKey(a) === orderGroupKey(b);
}

function byDossier(a: Order, b: Order): number {
  return String(a.orderNumber ?? "").localeCompare(String(b.orderNumber ?? ""), "en", { numeric: true });
}

export function siblingOrders(orders: Order[], order: Pick<Order, "id" | "contractId">): Order[] {
  const key = orderGroupKey(order);
  return orders.filter((o) => orderGroupKey(o) === key).sort(byDossier);
}

export function pickPrimaryOrder(siblings: Order[]): Order {
  const root = siblings.find((o) => o.orderNumber && !CHILD_SUFFIX.test(o.orderNumber));
  return root ?? siblings[0];
}

/** Mã đơn con tiếp theo trên cùng HĐ: DNY260901 → DNY260901-1 → DNY260901-2. */
export function nextSiblingDossierNumber(siblings: Order[]): string {
  const primary = siblings.length ? pickPrimaryOrder(siblings) : undefined;
  const base = dossierBaseNumber(primary?.orderNumber) || primary?.orderNumber || "DNY";
  const used = new Set(siblings.map((s) => s.orderNumber).filter(Boolean));
  let i = 1;
  while (used.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

export function isPrimaryOrder(order: Order, siblings: Order[]): boolean {
  if (siblings.length === 0) return true;
  return pickPrimaryOrder(siblings).id === order.id;
}

export function groupOrdersByContract(orders: Order[]): Order[][] {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    const key = orderGroupKey(o);
    const list = map.get(key) ?? [];
    list.push(o);
    map.set(key, list);
  }
  return [...map.values()].map((group) => [...group].sort(byDossier));
}

export function groupContractTotal(siblings: Order[]): number {
  return siblings.reduce((sum, o) => sum + (Number(o.value) || 0), 0);
}

function paymentStatus(paidAmount: number, totalAmount: number, installments: PaymentInstallment[]): PaymentStatus {
  if (totalAmount <= 0) return "unpaid";
  if (paidAmount <= 0) {
    const overdue = installments.some((i) => i.status === "overdue");
    return overdue ? "overdue" : "unpaid";
  }
  if (paidAmount >= totalAmount) return "paid";
  const overdue = installments.some(
    (i) => i.status === "overdue" || (i.status === "pending" && i.dueDate < new Date().toISOString().slice(0, 10)),
  );
  return overdue ? "overdue" : "partial";
}

export function recalcPayment(record: PaymentRecord): PaymentRecord {
  const paidAmount = record.installments
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const remaining = Math.max(0, record.totalAmount - paidAmount);
  return {
    ...record,
    paidAmount,
    remaining,
    status: paymentStatus(paidAmount, record.totalAmount, record.installments),
  };
}

/** Chia thu thanh toán HĐ theo tỷ lệ giá trị từng dịch vụ (phần dư vào đơn cuối). */
export function allocatePaymentShare(
  groupPayment: PaymentRecord | undefined,
  order: Order,
  siblings: Order[],
): PaymentRecord | undefined {
  if (!groupPayment) return undefined;
  const total = groupContractTotal(siblings);
  if (siblings.length <= 1 || total <= 0) {
    return recalcPayment({
      ...groupPayment,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: siblings.length <= 1 ? order.value : 0,
      groupedOrderIds: siblings.map((s) => s.id),
    });
  }

  const index = Math.max(0, siblings.findIndex((s) => s.id === order.id));
  const isLast = index === siblings.length - 1;
  const shares = siblings.map((s) => s.value / total);

  let totalAmount = Math.round(groupPayment.totalAmount * (shares[index] ?? 0));
  let installments = groupPayment.installments.map((i) => ({
    ...i,
    amount: Math.round(i.amount * (shares[index] ?? 0)),
  }));

  if (isLast) {
    totalAmount = Math.max(
      0,
      groupPayment.totalAmount -
        siblings.slice(0, -1).reduce((sum, _, i) => sum + Math.round(groupPayment.totalAmount * shares[i]), 0),
    );
    installments = groupPayment.installments.map((inst, instIdx) => {
      const prior = siblings.slice(0, -1).reduce((sum, _, i) => sum + Math.round(inst.amount * shares[i]), 0);
      return { ...inst, amount: Math.max(0, inst.amount - prior) };
    });
  }

  return recalcPayment({
    ...groupPayment,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount,
    groupedOrderIds: siblings.map((s) => s.id),
    installments,
  });
}
