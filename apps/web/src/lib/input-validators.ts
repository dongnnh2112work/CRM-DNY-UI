import type { Customer, Order, OrderExpense } from "@/lib/types";

export type MoneyIssue = "missing" | "invalid" | "negative" | "not_positive";
export type CommissionIssue = "missing" | "invalid" | "range" | "zero_unconfirmed";

/** Giữ dấu trừ để form báo lỗi thay vì nuốt thành 0. */
export function parseSignedVnd(display: string | undefined): number {
  const raw = display ?? "";
  const negative = raw.trim().startsWith("-");
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return Number.NaN;
  const amount = Number(digits);
  return negative ? -amount : amount;
}

export function formatSignedVnd(value: string | number | undefined | null): string {
  if (value === undefined || value === null || value === "") return "";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^\d-]/g, ""));
  if (!Number.isFinite(numeric)) return "";
  const negative = numeric < 0;
  const digits = String(Math.abs(Math.round(numeric)));
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return negative ? `-${grouped}` : grouped;
}

export const signedVndInputProps = {
  style: { width: "100%" as const },
  formatter: (value: string | number | undefined) => formatSignedVnd(value),
  parser: (value: string | undefined) => parseSignedVnd(value) as unknown as number,
};

export function moneyAmountIssue(value: unknown): MoneyIssue | null {
  if (value == null || value === "") return "missing";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "invalid";
  if (amount < 0) return "negative";
  if (amount === 0) return "not_positive";
  return null;
}

/** 100% được phép. 0% chỉ khi người dùng xác nhận rõ. Thiếu % không được coi là 0. */
export function commissionIssue(value: unknown, confirmedZero = false): CommissionIssue | null {
  if (value == null || value === "") return "missing";
  const percent = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(percent)) return "invalid";
  if (percent < 0 || percent > 100) return "range";
  if (percent === 0 && !confirmedZero) return "zero_unconfirmed";
  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailAddressIssue(input: unknown): "empty" | "invalid" | null {
  const raw = String(input ?? "").trim();
  if (!raw) return "empty";
  if (raw.length > 254 || !EMAIL_RE.test(raw)) return "invalid";
  return null;
}

/** Empty and whitespace-only names are the same rejection. */
export function trimmedNameIssue(input: unknown): "empty" | null {
  return String(input ?? "").trim() ? null : "empty";
}

const MOBILE_PREFIX = /^(3|5|7|8|9)\d{8}$/;
const LANDLINE_PREFIX = /^2\d{8,9}$/;

export function normalizeVnPhone(input: string): string {
  const compact = input.replace(/[\s.\-()]/g, "");
  if (!compact) return "";
  let digits = compact.startsWith("+") ? compact.slice(1) : compact;
  if (digits.startsWith("84") && digits.length >= 10) digits = `0${digits.slice(2)}`;
  if (!digits.startsWith("0") && (MOBILE_PREFIX.test(digits) || LANDLINE_PREFIX.test(digits))) {
    digits = `0${digits}`;
  }
  return digits;
}

export function vnPhoneIssue(input: unknown): "empty" | "invalid" | null {
  const raw = String(input ?? "").trim();
  if (!raw) return "empty";
  if (/[a-z]/i.test(raw)) return "invalid";
  const phone = normalizeVnPhone(raw);
  if (!/^0\d{9,10}$/.test(phone)) return "invalid";
  const national = phone.slice(1);
  if (MOBILE_PREFIX.test(national) || LANDLINE_PREFIX.test(national)) return null;
  return "invalid";
}

/** MST 10 số, hoặc 13 số dạng 10-3. Số thứ 10 là số kiểm tra. */
export function vnTaxIssue(input: unknown): "empty" | "invalid" | null {
  const raw = String(input ?? "").trim();
  if (!raw) return "empty";
  if (!/^\d{10}(-\d{3})?$/.test(raw)) return "invalid";
  const digits = raw.replace("-", "");
  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3];
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(digits[i]) * weights[i];
  const check = 10 - (sum % 11);
  if (check === 10 || check !== Number(digits[9])) return "invalid";
  return null;
}

export function duplicatePhoneCustomer(
  phone: string,
  customers: Pick<Customer, "id" | "name" | "phone">[],
  excludeId?: string,
): Pick<Customer, "id" | "name" | "phone"> | undefined {
  const needle = normalizeVnPhone(phone);
  if (!needle) return undefined;
  return customers.find((customer) => {
    if (excludeId && customer.id === excludeId) return false;
    return normalizeVnPhone(customer.phone ?? "") === needle;
  });
}

export function expensePayeeIssue(input: {
  payeeName?: string | null;
  bankAccount?: string | null;
  bankName?: string | null;
}): "payee" | "account" | "bank" | null {
  if (!String(input.payeeName ?? "").trim()) return "payee";
  if (!String(input.bankAccount ?? "").trim()) return "account";
  if (!String(input.bankName ?? "").trim()) return "bank";
  return null;
}

export function expenseReadyToApprove(expense: Pick<OrderExpense, "payeeName" | "bankAccount" | "bankName">): boolean {
  return expensePayeeIssue(expense) == null;
}

/**
 * Cảnh báo đề nghị chờ trùng đơn + số tiền, và người nhận nếu cả hai phía có.
 */
export function duplicatePendingExpense(
  expenses: OrderExpense[],
  candidate: { orderId?: string; amount: number; payeeName?: string; excludeId?: string },
): OrderExpense | undefined {
  const payee = String(candidate.payeeName ?? "").trim().toLowerCase();
  return expenses.find((expense) => {
    if (expense.status !== "pending") return false;
    if (candidate.excludeId && expense.id === candidate.excludeId) return false;
    if ((expense.orderId ?? "") !== (candidate.orderId ?? "")) return false;
    if (Number(expense.amount) !== Number(candidate.amount)) return false;
    const existingPayee = String(expense.payeeName ?? "").trim().toLowerCase();
    if (payee && existingPayee && payee !== existingPayee) return false;
    return true;
  });
}

/**
 * Số còn lại là tổng HĐ trừ tiền đã thu. Đợt chưa thu không nằm trong số đó,
 * nên sửa đợt chờ không được cộng thêm số cũ. Sửa đợt đã thu thì void giải phóng số cũ.
 */
export function installmentAmountIssue(
  amount: unknown,
  remaining: number,
  previous?: { amount: number; status?: string },
): MoneyIssue | "over_remaining" | null {
  const issue = moneyAmountIssue(amount);
  if (issue) return issue;
  const freed = previous?.status === "paid" ? Math.max(0, previous.amount) : 0;
  const cap = Math.max(0, remaining) + freed;
  if (Number(amount) > cap) return "over_remaining";
  return null;
}

export function orderFinanceLocked(order: Pick<Order, "stage"> | undefined): boolean {
  return order?.stage === "cancelled";
}

export function contractFinanceLocked(orders: Pick<Order, "stage">[]): boolean {
  return orders.length > 0 && orders.every((order) => order.stage === "cancelled");
}
