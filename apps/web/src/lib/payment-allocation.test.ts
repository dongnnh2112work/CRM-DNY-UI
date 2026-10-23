import { describe, expect, it } from "vitest";
import {
  allocateInstallmentsCumulative,
  allocateLargestRemainder,
  type AllocationTarget,
} from "@/lib/payment-allocation";

const t = (id: string, weight: number): AllocationTarget => ({ id, tieKey: id, weight });
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("allocateLargestRemainder", () => {
  it("splits exactly and ties go to the smaller order code", () => {
    expect(allocateLargestRemainder(5, [t("A", 1), t("B", 1), t("C", 1)])).toEqual([2, 2, 1]);
    // same result when the input order is shuffled
    expect(allocateLargestRemainder(5, [t("C", 1), t("B", 1), t("A", 1)])).toEqual([1, 2, 2]);
  });

  it("does not dump the remainder on the last order", () => {
    // 100 over 1:1:1 → A gets the extra đồng, not C
    expect(allocateLargestRemainder(100, [t("A", 1), t("B", 1), t("C", 1)])).toEqual([34, 33, 33]);
  });

  it("returns zeros for a zero-weight pool and clamps negative weights", () => {
    expect(allocateLargestRemainder(1000, [t("A", 0), t("B", 0)])).toEqual([0, 0]);
    expect(allocateLargestRemainder(1000, [t("A", -5), t("B", 100)])).toEqual([0, 1000]);
  });

  it("does not lose precision on very large amounts", () => {
    const big = 9_000_000_000_000;
    const out = allocateLargestRemainder(big, [t("A", 7), t("B", 11), t("C", 13)]);
    expect(sum(out)).toBe(big);
  });
});

describe("allocateInstallmentsCumulative", () => {
  const inst = (id: string, amount: number, dueDate: string, status = "paid") => ({ id, amount, dueDate, status });

  it("per-installment shares sum to the amount and cumulative equals a single allocation", () => {
    const targets = [t("A", 1_000_000), t("B", 2_000_000), t("C", 3_000_000)];
    const installments = [inst("i1", 2_000_000, "2026-01-01"), inst("i2", 1_500_000, "2026-02-01")];
    const shares = allocateInstallmentsCumulative(installments, targets);
    expect(shares[0]).toEqual([333_333, 666_667, 1_000_000]);
    expect(shares[1]).toEqual([250_000, 500_000, 750_000]);
    expect(sum(shares[0])).toBe(2_000_000);
    expect(sum(shares[1])).toBe(1_500_000);
    const cumulative = shares[0].map((v, i) => v + shares[1][i]);
    expect(cumulative).toEqual(allocateLargestRemainder(3_500_000, targets));
  });

  it("is deterministic regardless of array order", () => {
    const targets = [t("A", 1), t("B", 1), t("C", 1)];
    const a = inst("i1", 5, "2026-01-01");
    const b = inst("i2", 10, "2026-02-01");
    const x = allocateInstallmentsCumulative([a, b], targets);
    const y = allocateInstallmentsCumulative([b, a], targets);
    expect(y[1]).toEqual(x[0]);
    expect(y[0]).toEqual(x[1]);
  });

  it("keeps cancelled installments out of the cumulative sequence", () => {
    const targets = [t("A", 1), t("B", 1), t("C", 1)];
    const withVoid = allocateInstallmentsCumulative(
      [inst("i1", 5, "2026-01-01"), inst("v", 7, "2026-01-15", "cancelled"), inst("i2", 10, "2026-02-01")],
      targets,
    );
    const without = allocateInstallmentsCumulative([inst("i1", 5, "2026-01-01"), inst("i2", 10, "2026-02-01")], targets);
    expect(withVoid[0]).toEqual(without[0]);
    expect(withVoid[2]).toEqual(without[1]);
    expect(sum(withVoid[1])).toBe(7);
  });

  it("randomized: every installment sums exactly and cumulative never drifts", () => {
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let run = 0; run < 300; run += 1) {
      const n = 2 + Math.floor(rnd() * 4);
      const targets = Array.from({ length: n }, (_, i) => t(`O${i}`, 1 + Math.floor(rnd() * 5_000_000)));
      const k = 1 + Math.floor(rnd() * 5);
      const installments = Array.from({ length: k }, (_, i) =>
        inst(`i${i}`, 1 + Math.floor(rnd() * 9_000_000), `2026-01-0${i + 1}`),
      );
      const shares = allocateInstallmentsCumulative(installments, targets);
      let cum = 0;
      const acc = targets.map(() => 0);
      installments.forEach((installment, idx) => {
        expect(sum(shares[idx])).toBe(installment.amount);
        cum += installment.amount;
        shares[idx].forEach((v, i) => (acc[i] += v));
        expect(acc).toEqual(allocateLargestRemainder(cum, targets));
      });
    }
  });
});
