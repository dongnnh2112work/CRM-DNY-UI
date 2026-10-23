import type { Order, PaymentInstallment, PaymentRecord, PaymentStatus } from "@/lib/types";
import {
  allocateInstallmentsCumulative,
  allocateLargestRemainder,
  weightOf,
  type AllocationTarget,
} from "@/lib/payment-allocation";

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

/** Đơn còn hiệu lực. Đơn hủy không nhận phần thu khi HĐ còn đơn khác. Hủy hết thì giữ nguyên cả nhóm. */
function sharePool(siblings: Order[]): Order[] {
  const active = siblings.filter((s) => s.stage !== "cancelled");
  return active.length > 0 ? active : siblings;
}

/** Tổng giá HĐ (chưa VAT) của các đơn còn hiệu lực. Hủy hết thì tính cả nhóm. Giá âm coi là 0. */
export function groupContractTotal(siblings: Order[]): number {
  return sharePool(siblings).reduce((sum, o) => sum + weightOf(o.value), 0);
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

/**
 * Chia thu thanh toán HĐ cho từng dịch vụ còn hiệu lực theo tỷ lệ giá (chưa VAT) của đơn.
 * Mỗi đợt chia theo tổng lũy kế bằng phần dư lớn nhất (xem payment-allocation.ts):
 * tổng các phần của một đợt luôn đúng số tiền đợt, không dồn phần dư vào đơn cuối.
 *
 * - Đơn hủy (khi HĐ còn đơn khác): totalAmount 0, các đợt 0, remaining 0, status "cancelled".
 * - Tổng giá các đơn còn hiệu lực = 0 (và có từ 2 đơn): totalAmount mỗi đơn là 0; khoản thu được chia
 *   đều cho các đơn (không nhân đôi khoản thu cho từng đơn), nên tổng các đơn vẫn đúng số tiền thu.
 * - Chỉ đợt `paid` được tính là đã thu (do recalcPayment); đợt pending/cancelled vẫn có số chia để hiển thị.
 */
export function allocatePaymentShare(
  groupPayment: PaymentRecord | undefined,
  order: Order,
  siblings: Order[],
): PaymentRecord | undefined {
  if (!groupPayment) return undefined;
  const groupedOrderIds = siblings.map((s) => s.id);
  const pool = sharePool(siblings);
  const inPool = pool.some((s) => s.id === order.id);

  if (!inPool) {
    return {
      ...recalcPayment({
        ...groupPayment,
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: 0,
        groupedOrderIds,
        installments: groupPayment.installments.map((installment) => ({ ...installment, amount: 0 })),
      }),
      remaining: 0,
      status: "cancelled",
    };
  }

  if (pool.length <= 1) {
    return recalcPayment({
      ...groupPayment,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: weightOf(order.value),
      groupedOrderIds,
    });
  }

  const index = pool.findIndex((s) => s.id === order.id);
  if (index < 0) return undefined;
  const targets: AllocationTarget[] = pool.map((s) => ({
    weight: weightOf(s.value),
    tieKey: String(s.orderNumber ?? ""),
    id: String(s.id),
  }));
  const poolTotal = groupContractTotal(pool);
  // Tổng giá = 0 thì không có tỷ lệ: chia đều khoản thu để không mất và không nhân đôi tiền.
  const installmentTargets =
    poolTotal > 0 ? targets : targets.map((target) => ({ ...target, weight: 1 }));
  const shares = allocateInstallmentsCumulative(groupPayment.installments, installmentTargets);
  const installments = groupPayment.installments.map((installment, i) => ({
    ...installment,
    amount: shares[i]?.[index] ?? 0,
  }));
  // Chia giá HĐ cho chính nó cho ra đúng giá từng đơn; tổng giá = 0 thì mọi đơn là 0.
  const totalAmount = allocateLargestRemainder(poolTotal, targets)[index] ?? 0;

  return recalcPayment({
    ...groupPayment,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount,
    groupedOrderIds,
    installments,
  });
}
