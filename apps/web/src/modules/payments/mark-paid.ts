import { ApiError } from "@/lib/http/errors";
import { apiErrorMessage, isUuid, num } from "@/lib/http/message";
import { fetchAllPages } from "@/lib/http/paging";
import { PERMISSION } from "@/lib/rbac";
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

export class InstallmentUpdateFailed extends Error {
  constructor() {
    super("UPDATE_FAILED");
    this.name = "InstallmentUpdateFailed";
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

/** Sửa được khi API ghi được kết quả: phiếu thì cần tạo + hủy; dòng lịch thì cần sửa đơn. */
export function canEditInstallment(
  row: PaymentInstallment,
  can: (permission: string) => boolean,
): boolean {
  if (row.status === "cancelled") return false;
  // Có phương thức nghĩa là đã có phiếu (kể cả dòng tạm pi-… trên màn hình).
  if (knownPaymentId(row) || row.method) return can(PERMISSION.paymentCreate) && can(PERMISSION.paymentVoid);
  return can(PERMISSION.orderUpdate);
}

export type UpdatedInstallment = {
  payment?: ApiPayment;
  /** false khi phiếu mới đã ghi nhưng phiếu cũ vẫn còn. */
  previousVoided: boolean;
  scheduleUpdated: boolean;
};

/**
 * API không có PATCH phiếu. Sửa = ghi phiếu đúng, rồi hủy phiếu sai.
 * Hạn TT ghi vào lịch khi không làm đứt phiếu của đợt khác.
 */
export async function updateInstallmentPayment(input: {
  orderId: string;
  previousPaymentId?: string;
  previousScheduleLineId?: string;
  previousAmount: number;
  previousDueDate?: string;
  previousMethod?: PaymentMethod;
  wasPaid: boolean;
  amount: number;
  method?: PaymentMethod;
  dueDate?: string;
  markPaid: boolean;
}): Promise<UpdatedInstallment> {
  const dueChanged =
    Boolean(input.dueDate) && input.dueDate!.slice(0, 10) !== (input.previousDueDate ?? "").slice(0, 10);
  const amountChanged = input.amount !== input.previousAmount;
  const methodChanged = Boolean(input.method && input.previousMethod && input.method !== input.previousMethod);
  const paidChanged = input.markPaid !== input.wasPaid;
  const scheduleLineId =
    input.dueDate && (dueChanged || amountChanged || !input.previousScheduleLineId)
      ? await rewriteScheduleForEdit({
          orderId: input.orderId,
          previousPaymentId: input.previousPaymentId,
          previousScheduleLineId: input.previousScheduleLineId,
          previousAmount: input.previousAmount,
          previousDueDate: input.previousDueDate,
          amount: input.amount,
          dueDate: input.dueDate,
        })
      : input.previousScheduleLineId;
  const scheduleUpdated = Boolean(scheduleLineId && scheduleLineId !== input.previousScheduleLineId);
  const replacePayment =
    amountChanged || methodChanged || paidChanged || (Boolean(input.previousPaymentId) && scheduleUpdated);
  if (input.previousPaymentId && !replacePayment) {
    if (dueChanged && !scheduleUpdated) throw new InstallmentUpdateFailed();
    return { previousVoided: true, scheduleUpdated };
  }
  if (!input.previousPaymentId && !input.markPaid && !input.method) {
    if (!scheduleUpdated && (dueChanged || amountChanged)) throw new InstallmentUpdateFailed();
    return { previousVoided: true, scheduleUpdated };
  }

  const created = await paymentsApi.create({
    orderId: input.orderId,
    amount: input.amount,
    method: input.method ?? "BANK_TRANSFER",
    scheduleLineId,
  });
  try {
    if (input.markPaid) await paymentsApi.verify(created.id);
  } catch (err) {
    await paymentsApi.void(created.id).catch(() => undefined);
    throw err;
  }

  let previousVoided = !input.previousPaymentId || input.previousPaymentId === created.id;
  if (input.previousPaymentId && input.previousPaymentId !== created.id) {
    try {
      const rows = await listOrderPayments(input.orderId);
      const previous = rows.find((payment) => payment.id === input.previousPaymentId);
      if (!previous || previous.verificationStatus === "VOIDED") previousVoided = true;
      else {
        await paymentsApi.void(previous.id);
        previousVoided = true;
      }
    } catch {
      previousVoided = false;
    }
  }

  return { payment: created, previousVoided, scheduleUpdated };
}

async function rewriteScheduleForEdit(input: {
  orderId: string;
  previousPaymentId?: string;
  previousScheduleLineId?: string;
  previousAmount: number;
  previousDueDate?: string;
  amount: number;
  dueDate: string;
}): Promise<string | undefined> {
  let current: ApiScheduleLine[];
  try {
    current = unwrapSchedule(await ordersApi.listSchedule(input.orderId));
  } catch {
    return undefined;
  }
  const unchanged = current.find((line) => {
    const due = (line.dueDate ?? "").slice(0, 10);
    const sameLine = input.previousScheduleLineId ? line.id === input.previousScheduleLineId : current.length === 1;
    return Boolean(line.id) && sameLine && due === input.dueDate && num(line.amount) === input.amount;
  });
  if (unchanged?.id) return unchanged.id;
  let payments: ApiPayment[] = [];
  try {
    payments = await listOrderPayments(input.orderId);
  } catch {
    return undefined;
  }
  const blocksRewrite = payments.some(
    (payment) =>
      payment.verificationStatus !== "VOIDED" &&
      Boolean(payment.scheduleLineId) &&
      payment.id !== input.previousPaymentId,
  );
  if (blocksRewrite && current.length > 0) return undefined;

  try {
    let replaced = current.length === 0;
    const lines =
      current.length === 0
        ? [{ dueDate: input.dueDate, amount: input.amount, sortOrder: 0 }]
        : current.map((line, index) => {
            const due = (line.dueDate ?? "").slice(0, 10);
            const isTarget =
              !replaced &&
              ((input.previousScheduleLineId && line.id === input.previousScheduleLineId) ||
                (!input.previousScheduleLineId && current.length === 1) ||
                (!input.previousScheduleLineId &&
                  due === (input.previousDueDate ?? "").slice(0, 10) &&
                  num(line.amount) === input.previousAmount));
            if (!isTarget) {
              return { dueDate: due || undefined, amount: num(line.amount), sortOrder: line.sortOrder ?? index };
            }
            replaced = true;
            return { dueDate: input.dueDate, amount: input.amount, sortOrder: line.sortOrder ?? index };
          });
    if (!replaced) lines.push({ dueDate: input.dueDate, amount: input.amount, sortOrder: lines.length });
    await ordersApi.replaceSchedule(input.orderId, lines);
    const next = unwrapSchedule(await ordersApi.listSchedule(input.orderId));
    return (
      next.find((line) => (line.dueDate ?? "").slice(0, 10) === input.dueDate && num(line.amount) === input.amount)?.id ??
      next.find((line) => line.id)?.id
    );
  } catch {
    return undefined;
  }
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
