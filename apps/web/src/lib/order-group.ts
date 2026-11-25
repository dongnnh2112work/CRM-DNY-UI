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

/**
 * Đơn còn hiệu lực — dùng cho nghĩa vụ HĐ và các đợt chưa xác minh.
 * Hủy hết thì giữ nguyên cả nhóm (không làm tổng về 0).
 * Đợt đã xác minh KHÔNG dùng pool này: xem `frozenPool`.
 */
function activePool(siblings: Order[]): Order[] {
  const active = siblings.filter((s) => s.stage !== "cancelled");
  return active.length > 0 ? active : siblings;
}

/** @deprecated name kept for call sites that mean the active obligation pool. */
function sharePool(siblings: Order[]): Order[] {
  return activePool(siblings);
}

function dayOf(iso?: string | null): string {
  if (!iso) return "";
  const day = iso.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

/**
 * Dịch vụ được giữ phần của một đợt ĐÃ xác minh.
 * Gồm cả đơn đã hủy (tiền lịch sử không đổ sang đơn còn lại) và loại đơn tạo sau ngày thu.
 * Thiếu ngày thì coi là đơn gốc — vẫn nằm trong pool, để dữ liệu cũ không đổi cách chia.
 */
function frozenPool(siblings: Order[], paidAt?: string | null): Order[] {
  const paidDay = dayOf(paidAt);
  const eligible = siblings.filter((order) => {
    const created = dayOf(order.createdAt);
    if (!paidDay || !created) return true;
    return created <= paidDay;
  });
  return eligible.length > 0 ? eligible : siblings;
}

function poolForInstallment(siblings: Order[], installment: PaymentInstallment): Order[] {
  if (installment.status === "paid") return frozenPool(siblings, installment.paidDate ?? installment.dueDate);
  return activePool(siblings);
}

function poolKey(pool: Order[]): string {
  return pool
    .map((order) => order.id)
    .sort()
    .join("|");
}

function allocationTargets(pool: Order[]): AllocationTarget[] {
  const weighted = pool.map((order) => weightOf(order.value));
  const even = weighted.every((weight) => weight === 0);
  return pool.map((order, index) => ({
    weight: even ? 1 : weighted[index],
    tieKey: String(order.orderNumber ?? ""),
    id: String(order.id),
  }));
}

/** Tổng giá HĐ (chưa VAT) của các đơn còn hiệu lực. Hủy hết thì tính cả nhóm. Giá âm coi là 0. */
export function groupContractTotal(siblings: Order[]): number {
  return sharePool(siblings).reduce((sum, o) => sum + weightOf(o.value), 0);
}

function installmentStillOpen(installment: PaymentInstallment, today: string): boolean {
  return installment.status === "pending" || installment.status === "overdue" || (
    installment.status !== "paid" && installment.status !== "cancelled" && installment.dueDate < today
  );
}

/**
 * "Đã thu đủ" chỉ khi đã thu đúng bằng tổng được phân và không còn đợt mở.
 * Thu vượt tổng không được coi là đã thu đủ (UI hiện cảnh báo). Đợt pending/overdue chặn trạng thái paid.
 */
function paymentStatus(paidAmount: number, totalAmount: number, installments: PaymentInstallment[]): PaymentStatus {
  const today = new Date().toISOString().slice(0, 10);
  const open = installments.some((installment) => installmentStillOpen(installment, today));
  const overdue = installments.some(
    (installment) =>
      installment.status === "overdue" ||
      (installment.status === "pending" && installment.dueDate < today),
  );
  if (open) {
    if (paidAmount <= 0) return overdue ? "overdue" : "unpaid";
    return overdue ? "overdue" : "partial";
  }
  if (totalAmount <= 0) return paidAmount > 0 ? "partial" : "unpaid";
  if (paidAmount <= 0) return "unpaid";
  if (paidAmount === totalAmount) return "paid";
  return "partial";
}

export type CollectionState = {
  open: boolean;
  overpaid: boolean;
  collectedInFull: boolean;
};

/** Quyết định nhãn "Đã thu đủ" / cảnh báo thu vượt. Không dùng `remaining === 0` một mình. */
export function collectionState(
  paidAmount: number,
  totalAmount: number,
  installments: Pick<PaymentInstallment, "status">[],
): CollectionState {
  const open = installments.some((installment) => installment.status === "pending" || installment.status === "overdue");
  const overpaid = totalAmount > 0 && paidAmount > totalAmount;
  const collectedInFull =
    !open && !overpaid && totalAmount > 0 && paidAmount === totalAmount;
  return { open, overpaid, collectedInFull };
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

function compareInstallments(a: PaymentInstallment, b: PaymentInstallment): number {
  const byDue = String(a.dueDate ?? "").localeCompare(String(b.dueDate ?? ""));
  if (byDue !== 0) return byDue;
  return String(a.id).localeCompare(String(b.id), "en", { numeric: true });
}

/**
 * Phần của `order` trên từng đợt.
 * Các đợt cùng một pool được chia lũy kế (giữ kết quả cũ khi mọi đơn còn hiệu lực).
 * Đổi pool (hủy đơn, hoặc thêm dịch vụ sau ngày đã thu) thì không viết lại các đợt đã xác minh.
 */
function installmentShares(installments: PaymentInstallment[], order: Order, siblings: Order[]): number[] {
  const amounts = installments.map(() => 0);
  const group = siblings.length > 0 ? siblings : [order];
  const live = installments
    .map((installment, index) => ({ installment, index }))
    .filter(({ installment }) => installment.status !== "cancelled")
    .sort((a, b) => compareInstallments(a.installment, b.installment));

  let cursor = 0;
  while (cursor < live.length) {
    const pool = poolForInstallment(group, live[cursor].installment);
    const key = poolKey(pool);
    let end = cursor + 1;
    while (end < live.length && poolKey(poolForInstallment(group, live[end].installment)) === key) end += 1;
    const segment = live.slice(cursor, end);
    const targets = allocationTargets(pool);
    const shares = allocateInstallmentsCumulative(
      segment.map((item) => item.installment),
      targets,
    );
    const orderIndex = pool.findIndex((row) => row.id === order.id);
    segment.forEach((item, index) => {
      amounts[item.index] = orderIndex < 0 ? 0 : (shares[index]?.[orderIndex] ?? 0);
    });
    cursor = end;
  }

  installments.forEach((installment, index) => {
    if (installment.status !== "cancelled") return;
    const pool = poolForInstallment(group, installment);
    const shares = allocateLargestRemainder(installment.amount, allocationTargets(pool));
    const orderIndex = pool.findIndex((row) => row.id === order.id);
    amounts[index] = orderIndex < 0 ? 0 : (shares[orderIndex] ?? 0);
  });
  return amounts;
}

/**
 * Chia thu của hợp đồng cho từng dịch vụ.
 *
 * Đợt đã xác minh được đóng băng theo tập dịch vụ có mặt vào ngày thu (kể cả đơn sau đó bị hủy).
 * Thêm dịch vụ không viết lại các đợt đã thu. Hủy một dịch vụ không chuyển khoản đã thu sang đơn còn lại,
 * nên đơn còn lại không bị đánh "Đã thu đủ" chỉ vì kế thừa tiền, và lương không tăng vì chi biến mất còn thu dồn sang.
 *
 * Đợt chưa xác minh chỉ chia cho đơn còn hiệu lực (dịch vụ mới được nhận tiền thu sau này).
 *
 * - Đơn hủy khi HĐ còn đơn khác: giữ phần đã thu lịch sử, đợt chưa thu = 0, remaining 0, status "cancelled"
 *   (không còn nợ mới; lương vẫn thấy khoản đã thu và chi đã duyệt).
 * - Tổng giá = 0: totalAmount mỗi đơn là 0; khoản thu chia đều, không nhân đôi.
 * - Chỉ đợt `paid` tính là đã thu.
 */
export function allocatePaymentShare(
  groupPayment: PaymentRecord | undefined,
  order: Order,
  siblings: Order[],
): PaymentRecord | undefined {
  if (!groupPayment) return undefined;
  const group = siblings.length > 0 ? siblings : [order];
  const groupedOrderIds = group.map((row) => row.id);
  const survivors = group.filter((row) => row.stage !== "cancelled");
  const active = activePool(group);
  const heldOnCancelled = order.stage === "cancelled" && survivors.length > 0;
  const amounts = installmentShares(groupPayment.installments, order, group);
  const installments = groupPayment.installments.map((installment, index) => ({
    ...installment,
    amount: amounts[index] ?? 0,
  }));

  let totalAmount = 0;
  if (!heldOnCancelled && active.some((row) => row.id === order.id)) {
    if (active.length <= 1) {
      totalAmount = weightOf(order.value);
    } else {
      const targets = active.map((row) => ({
        weight: weightOf(row.value),
        tieKey: String(row.orderNumber ?? ""),
        id: String(row.id),
      }));
      const index = active.findIndex((row) => row.id === order.id);
      totalAmount = allocateLargestRemainder(groupContractTotal(active), targets)[index] ?? 0;
    }
  }

  const share = recalcPayment({
    ...groupPayment,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalAmount,
    groupedOrderIds,
    installments,
  });
  if (!heldOnCancelled) return share;
  return { ...share, totalAmount: 0, remaining: 0, status: "cancelled" };
}

export type ContractMoneyView = {
  /** Nghĩa vụ của các đơn còn hiệu lực (không phải “đơn này còn nợ”). */
  contractTotal: number;
  /** Phần đã thu gắn với đơn còn hiệu lực — không tính tiền đang giữ trên đơn đã hủy. */
  allocatedPaid: number;
  /** Tổng tiền các đợt đã xác minh trên lịch HĐ. */
  cashPaid: number;
  contractRemaining: number;
  open: boolean;
  overpaid: boolean;
  collectedInFull: boolean;
};

/** Số liệu HĐ để gắn nhãn trên dòng cha / màn thanh toán. Không viết lại từng đợt. */
export function contractMoneyView(record: PaymentRecord, siblings: Order[]): ContractMoneyView {
  const group = siblings.length > 0 ? siblings : [];
  const active = group.length > 0 ? activePool(group) : [];
  const contractTotal = group.length > 0 ? groupContractTotal(group) : record.totalAmount;
  const cashPaid = record.installments
    .filter((installment) => installment.status === "paid")
    .reduce((sum, installment) => sum + installment.amount, 0);
  const allocatedPaid = active.reduce((sum, order) => {
    return sum + (allocatePaymentShare(record, order, group)?.paidAmount ?? 0);
  }, 0);
  const state = collectionState(allocatedPaid, contractTotal, record.installments);
  return {
    contractTotal,
    allocatedPaid,
    cashPaid,
    contractRemaining: contractTotal - allocatedPaid,
    ...state,
  };
}

/**
 * Dòng thanh toán HĐ (một record cho cả nhóm): paid/remaining/status theo phần của đơn còn hiệu lực,
 * không theo việc dồn toàn bộ tiền đã thu sang đơn sống sót.
 */
export function presentGroupPayment(record: PaymentRecord, siblings: Order[]): PaymentRecord {
  if (siblings.length === 0) return recalcPayment(record);
  const view = contractMoneyView(record, siblings);
  const remaining = Math.max(0, view.contractRemaining);
  return {
    ...record,
    totalAmount: view.contractTotal,
    paidAmount: view.allocatedPaid,
    remaining,
    status: paymentStatus(view.allocatedPaid, view.contractTotal, record.installments),
  };
}
