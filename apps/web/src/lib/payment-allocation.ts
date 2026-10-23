/**
 * Chia tiền thu của hợp đồng cho các đơn dịch vụ con.
 *
 * - Số tiền là VND nguyên (được làm tròn về số nguyên trước khi chia).
 * - Dùng BigInt để tích `tổng × trọng số` không tràn 2^53.
 * - Phương pháp phần dư lớn nhất (largest remainder, Hamilton). Khi hai đơn bằng phần dư
 *   thì đơn có mã nhỏ hơn (so sánh số học) được cộng 1 đồng trước, nên kết quả
 *   không phụ thuộc thứ tự mảng đầu vào.
 */

export type AllocationTarget = {
  /** Trọng số (giá trị đơn, đơn vị VND). Giá trị âm hoặc không hợp lệ coi là 0. */
  weight: number;
  /** Khóa phá hòa khi phần dư bằng nhau (mã đơn). */
  tieKey: string;
  /** Khóa phụ để kết quả luôn xác định, kể cả khi trùng mã đơn. */
  id: string;
};

export function weightOf(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function compareKeys(a: AllocationTarget, b: AllocationTarget): number {
  const byCode = a.tieKey.localeCompare(b.tieKey, "en", { numeric: true });
  return byCode !== 0 ? byCode : a.id.localeCompare(b.id, "en", { numeric: true });
}

/**
 * Chia `total` (số nguyên, có thể âm) theo trọng số bằng largest remainder.
 * Tổng kết quả luôn đúng bằng `Math.round(total)` khi có ít nhất một trọng số dương.
 * Tổng trọng số = 0 thì trả về toàn 0 (không nhân đôi khoản thu cho từng đơn).
 * Trả về mảng cùng thứ tự `targets`.
 */
export function allocateLargestRemainder(total: number, targets: AllocationTarget[]): number[] {
  const out = targets.map(() => 0);
  const t = Math.round(Number(total) || 0);
  if (t === 0) return out;
  const weights = targets.map((x) => BigInt(weightOf(x.weight)));
  const sum = weights.reduce((s, w) => s + w, BigInt(0));
  if (sum === BigInt(0)) return out;

  const zero = BigInt(0);
  const negative = t < 0;
  const abs = BigInt(Math.abs(t));
  const floors = weights.map((w) => (abs * w) / sum);
  const remainders = weights.map((w) => (abs * w) % sum);
  const leftover = Number(abs - floors.reduce((s, f) => s + f, zero));

  const ranking = targets
    .map((x, i) => i)
    .filter((i) => weights[i] > zero)
    .sort((a, b) => {
      if (remainders[a] !== remainders[b]) return remainders[a] > remainders[b] ? -1 : 1;
      return compareKeys(targets[a], targets[b]);
    });

  const result = floors.map((f) => Number(f));
  for (let k = 0; k < leftover; k += 1) result[ranking[k]] += 1;
  return negative ? result.map((v) => -v) : result;
}

export type SequencedInstallment = {
  id: string;
  amount: number;
  dueDate?: string;
  status: string;
};

/**
 * Chia từng đợt thu theo LŨY KẾ: phần của đơn ở đợt k =
 * chia(tổng lũy kế đến đợt k) − chia(tổng lũy kế đến đợt k−1).
 *
 * Nhờ đó (a) tổng phần chia của một đợt = đúng số tiền đợt, (b) tổng lũy kế của từng đơn
 * bằng đúng kết quả chia một lần cho tổng lũy kế, không trôi số.
 *
 * Thứ tự đợt: dueDate tăng dần, rồi id (không phụ thuộc thứ tự mảng).
 * Đợt đã hủy không tham gia dãy lũy kế (không làm lệch phần chia của đợt khác);
 * chúng vẫn được chia riêng theo cùng phương pháp để có số hiển thị, và không được tính là đã thu.
 *
 * Trả về mảng cùng thứ tự `installments`; mỗi phần tử là mảng phần chia theo thứ tự `targets`.
 */
export function allocateInstallmentsCumulative(
  installments: SequencedInstallment[],
  targets: AllocationTarget[],
): number[][] {
  const result: number[][] = installments.map(() => targets.map(() => 0));
  const live = installments
    .map((installment, index) => ({ installment, index }))
    .filter(({ installment }) => installment.status !== "cancelled")
    .sort((a, b) => {
      const byDue = String(a.installment.dueDate ?? "").localeCompare(String(b.installment.dueDate ?? ""));
      if (byDue !== 0) return byDue;
      const byId = String(a.installment.id).localeCompare(String(b.installment.id), "en", { numeric: true });
      return byId !== 0 ? byId : a.index - b.index;
    });

  let cumulative = 0;
  let previous = targets.map(() => 0);
  for (const { installment, index } of live) {
    cumulative += Math.round(Number(installment.amount) || 0);
    const current = allocateLargestRemainder(cumulative, targets);
    result[index] = current.map((value, i) => value - previous[i]);
    previous = current;
  }

  installments.forEach((installment, index) => {
    if (installment.status === "cancelled") result[index] = allocateLargestRemainder(installment.amount, targets);
  });
  return result;
}
