import { ApiError } from "@/lib/http/errors";
import { apiErrorMessage, isUuid, num } from "@/lib/http/message";
import { fetchAllPages } from "@/lib/http/paging";
import type { PaymentInstallment } from "@/lib/types";
import { ordersApi, type ApiScheduleLine } from "@/modules/orders/api";
import { paymentsApi, type ApiPayment, type PaymentMethod } from "@/modules/payments/api";
import { unwrapSchedule } from "@/modules/payments/map-to-ui";

const METHOD_BY_LABEL: Record<string, PaymentMethod> = {
  CASH: "CASH",
  Cash: "CASH",
  QR: "QR_PAYMENT",
  QR_PAYMENT: "QR_PAYMENT",
  BANK_TRANSFER: "BANK_TRANSFER",
  "Bank transfer": "BANK_TRANSFER",
};

export function toPaymentMethod(value: unknown): PaymentMethod {
  if (typeof value === "string" && METHOD_BY_LABEL[value]) return METHOD_BY_LABEL[value];
  return "BANK_TRANSFER";
}

/** Id phiếu mà `POST /payments/:id/verify` nhận. Id dòng lịch không tính. */
export function knownPaymentId(row: PaymentInstallment): string | undefined {
  if (row.paymentId && isUuid(row.paymentId)) return row.paymentId;
  if (row.voidable && isUuid(row.id)) return row.id;
  // Dòng phiếu luôn có phương thức. Dòng lịch chưa có phiếu thì không.
  if (row.method && isUuid(row.id)) return row.id;
  return undefined;
}

export function takenPaymentIds(rows: PaymentInstallment[], currentId: string): string[] {
  const ids: string[] = [];
  for (const row of rows) {
    if (row.id === currentId) continue;
    const id = knownPaymentId(row);
    if (id) ids.push(id);
  }
  return ids;
}

/** Phiếu RECORDED cùng số tiền (và phương thức, nếu dòng có) — mới nhất trước. */
export function pickPaymentForInstallment(
  rows: ApiPayment[],
  row: Pick<PaymentInstallment, "amount" | "method">,
  taken: ReadonlySet<string>,
): ApiPayment | undefined {
  const method = row.method ? toPaymentMethod(row.method) : undefined;
  const candidates = rows.filter((payment) => {
    if (payment.verificationStatus === "VOIDED" || taken.has(payment.id)) return false;
    if (num(payment.amount) !== row.amount) return false;
    if (method && payment.method !== method) return false;
    return true;
  });
  candidates.sort((a, b) => {
    const rank = (status: ApiPayment["verificationStatus"]) => (status === "RECORDED" ? 0 : 1);
    const byStatus = rank(a.verificationStatus) - rank(b.verificationStatus);
    if (byStatus !== 0) return byStatus;
    return (b.recordedAt || "").localeCompare(a.recordedAt || "");
  });
  return candidates[0];
}

export class InstallmentPaymentMissing extends Error {
  constructor() {
    super("PAYMENT_NOT_FOUND");
    this.name = "InstallmentPaymentMissing";
  }
}

async function listOrderPayments(orderId: string): Promise<ApiPayment[]> {
  return fetchAllPages((page, pageSize) => paymentsApi.list({ page, pageSize, orderId }));
}

/**
 * Id để verify.
 * Dòng "Thêm đợt" cũ dùng `pi-<timestamp>` nên verify 404. Khớp phiếu RECORDED
 * đã tạo cùng số tiền, hoặc tạo phiếu mới khi dòng chỉ là lịch thanh toán.
 */
export async function resolvePaymentIdForInstallment(
  orderId: string,
  row: PaymentInstallment,
  taken: Iterable<string>,
): Promise<string> {
  const direct = knownPaymentId(row);
  if (direct) return direct;

  const rows = await listOrderPayments(orderId);
  const match = pickPaymentForInstallment(rows, row, new Set(taken));
  if (match) return match.id;

  if (!row.method && isUuid(row.id)) {
    const created = await paymentsApi.create({
      orderId,
      amount: row.amount,
      method: "BANK_TRANSFER",
      scheduleLineId: row.id,
    });
    return created.id;
  }

  throw new InstallmentPaymentMissing();
}

/** Verify, and treat "already VERIFIED" as success so a stale row can still flip to Đã TT. */
export async function verifyInstallmentPayment(orderId: string, paymentId: string): Promise<void> {
  try {
    await paymentsApi.verify(paymentId);
  } catch (err) {
    try {
      const rows = await listOrderPayments(orderId);
      if (rows.some((payment) => payment.id === paymentId && payment.verificationStatus === "VERIFIED")) return;
    } catch {
      // Giữ lỗi verify gốc khi không đọc lại được danh sách.
    }
    throw err;
  }
}

export function markPaidErrorMessage(
  err: unknown,
  copy: { failed: string; forbidden: string; missing: string },
): string {
  if (err instanceof InstallmentPaymentMissing) return copy.missing;
  if (err instanceof ApiError && err.isForbidden) return copy.forbidden;
  return apiErrorMessage(err, copy.failed);
}

/**
 * Ghi hạn TT vào lịch khi đơn chưa có lịch.
 * POST schedule thay cả danh sách và không nhận id dòng — không gọi khi đã có dòng,
 * kẻo phiếu cũ mất `scheduleLineId`.
 */
export async function createInstallmentPayment(input: {
  orderId: string;
  amount: number;
  method: PaymentMethod;
  dueDate?: string;
}): Promise<ApiPayment> {
  const scheduleLineId = input.dueDate
    ? await scheduleLineForNewInstallment(input.orderId, input.dueDate, input.amount)
    : undefined;
  return paymentsApi.create({
    orderId: input.orderId,
    amount: input.amount,
    method: input.method,
    scheduleLineId,
  });
}

async function scheduleLineForNewInstallment(
  orderId: string,
  dueDate: string,
  amount: number,
): Promise<string | undefined> {
  let current: ApiScheduleLine[];
  try {
    current = unwrapSchedule(await ordersApi.listSchedule(orderId));
  } catch {
    return undefined;
  }
  if (current.length > 0) return undefined;
  try {
    await ordersApi.replaceSchedule(orderId, [{ dueDate, amount, sortOrder: 0 }]);
    const next = unwrapSchedule(await ordersApi.listSchedule(orderId));
    const lineId = next.find((line) => line.id && num(line.amount) === amount)?.id ?? next.find((line) => line.id)?.id;
    if (lineId) return lineId;
    // Không có id thì dòng lịch đứng riêng cạnh phiếu — gỡ lịch vừa tạo.
    await ordersApi.replaceSchedule(orderId, []).catch(() => undefined);
    return undefined;
  } catch {
    return undefined;
  }
}
