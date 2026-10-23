import { describe, expect, it } from "vitest";
import { allocatePaymentShare, groupContractTotal, recalcPayment } from "@/lib/order-group";
import type { Order, PaymentInstallment, PaymentRecord } from "@/lib/types";

function order(id: string, orderNumber: string, value: number, stage = "processing"): Order {
  return { id, orderNumber, value, stage, contractId: "c1" } as unknown as Order;
}

function installment(
  id: string,
  amount: number,
  dueDate: string,
  status: PaymentInstallment["status"] = "paid",
): PaymentInstallment {
  return { id, amount, dueDate, status };
}

function groupPayment(siblings: Order[], installments: PaymentInstallment[]): PaymentRecord {
  return recalcPayment({
    id: "pay-1",
    orderId: siblings[0].id,
    orderNumber: siblings[0].orderNumber,
    customerId: "cus",
    customerName: "Khách",
    totalAmount: groupContractTotal(siblings),
    paidAmount: 0,
    remaining: 0,
    status: "unpaid",
    installments,
    groupedOrderIds: siblings.map((s) => s.id),
  });
}

function shareOf(pay: PaymentRecord, siblings: Order[], o: Order) {
  const r = allocatePaymentShare(pay, o, siblings);
  if (!r) throw new Error("missing share");
  return r;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("allocatePaymentShare — contract payment split", () => {
  const A = order("a", "DNY1", 1_000_000);
  const B = order("b", "DNY1-1", 2_000_000);
  const C = order("c", "DNY1-2", 3_000_000);
  const siblings = [A, B, C];

  it("1tr/2tr/3tr paid 2,000,000 then 1,500,000", () => {
    const pay = groupPayment(siblings, [
      installment("i1", 2_000_000, "2026-01-10"),
      installment("i2", 1_500_000, "2026-02-10"),
    ]);
    const parts = siblings.map((s) => shareOf(pay, siblings, s));
    expect(parts.map((p) => p.installments.map((i) => i.amount))).toEqual([
      [333_333, 250_000],
      [666_667, 500_000],
      [1_000_000, 750_000],
    ]);
    expect(sum(parts.map((p) => p.installments[0].amount))).toBe(2_000_000);
    expect(sum(parts.map((p) => p.installments[1].amount))).toBe(1_500_000);
    expect(parts.map((p) => p.paidAmount)).toEqual([583_333, 1_166_667, 1_750_000]);
    expect(sum(parts.map((p) => p.totalAmount))).toBe(6_000_000);
  });

  it("three orders of 1đ with installments 5 and 10", () => {
    const orders = [order("a", "DNY2", 1), order("b", "DNY2-1", 1), order("c", "DNY2-2", 1)];
    const pay = groupPayment(orders, [installment("i1", 5, "2026-01-10"), installment("i2", 10, "2026-02-10")]);
    const parts = orders.map((o) => shareOf(pay, orders, o));
    expect(parts.map((p) => p.installments.map((i) => i.amount))).toEqual([
      [2, 3],
      [2, 3],
      [1, 4],
    ]);
    expect(sum(parts.map((p) => p.paidAmount))).toBe(15);
  });

  it("all-zero-value orders paid 1000: total is 1000, not duplicated", () => {
    const orders = [order("a", "DNY3", 0), order("b", "DNY3-1", 0)];
    const pay = groupPayment(orders, [installment("i1", 1000, "2026-01-10")]);
    const parts = orders.map((o) => shareOf(pay, orders, o));
    expect(parts.map((p) => p.installments[0].amount)).toEqual([500, 500]);
    expect(sum(parts.map((p) => p.paidAmount))).toBe(1000);
    expect(parts.map((p) => p.totalAmount)).toEqual([0, 0]);
  });

  it("overpayment 7,000,000 on 6,000,000 is allocated proportionally and does not crash", () => {
    const pay = groupPayment(siblings, [installment("i1", 7_000_000, "2026-01-10")]);
    const parts = siblings.map((s) => shareOf(pay, siblings, s));
    expect(parts.map((p) => p.installments[0].amount)).toEqual([1_166_667, 2_333_333, 3_500_000]);
    expect(sum(parts.map((p) => p.paidAmount))).toBe(7_000_000);
    expect(parts.every((p) => p.remaining === 0 && p.status === "paid")).toBe(true);
  });

  it("only paid installments count as paid; pending ones are still allocated", () => {
    const pay = groupPayment(siblings, [
      installment("i1", 2_000_000, "2026-01-10"),
      installment("i2", 1_500_000, "2099-02-10", "pending"),
    ]);
    const b = shareOf(pay, siblings, B);
    expect(b.installments.map((i) => i.amount)).toEqual([666_667, 500_000]);
    expect(b.paidAmount).toBe(666_667);
    expect(b.remaining).toBe(2_000_000 - 666_667);
  });

  it("negative order value gets zero weight", () => {
    const orders = [order("a", "DNY4", -500), order("b", "DNY4-1", 1000)];
    const pay = groupPayment(orders, [installment("i1", 100, "2026-01-10")]);
    const parts = orders.map((o) => shareOf(pay, orders, o));
    expect(parts.map((p) => p.installments[0].amount)).toEqual([0, 100]);
    expect(parts.map((p) => p.totalAmount)).toEqual([0, 1000]);
  });

  it("result does not depend on the order of the siblings array", () => {
    const pay = groupPayment(siblings, [
      installment("i1", 2_000_000, "2026-01-10"),
      installment("i2", 1_500_000, "2026-02-10"),
    ]);
    const shuffled = [C, A, B];
    expect(shareOf(pay, shuffled, B).installments.map((i) => i.amount)).toEqual(
      shareOf(pay, siblings, B).installments.map((i) => i.amount),
    );
  });
});

describe("cancelled orders in a multi-service contract", () => {
  const A = order("a", "DNY5", 1_000_000);
  const B = order("b", "DNY5-1", 2_000_000, "cancelled");

  it("groupContractTotal excludes cancelled orders", () => {
    expect(groupContractTotal([A, B])).toBe(1_000_000);
  });

  it("groupContractTotal keeps the whole group when every order is cancelled", () => {
    const x = order("x", "DNY6", 1_000_000, "cancelled");
    const y = order("y", "DNY6-1", 2_000_000, "cancelled");
    expect(groupContractTotal([x, y])).toBe(3_000_000);
  });

  it("group record no longer shows the cancelled order as owing", () => {
    const pay = groupPayment([A, B], [installment("i1", 400_000, "2026-01-10")]);
    expect(pay.totalAmount).toBe(1_000_000);
    expect(pay.remaining).toBe(600_000);
  });

  it("cancelled order has remaining 0, status cancelled, and no share", () => {
    const pay = groupPayment([A, B], [installment("i1", 400_000, "2026-01-10")]);
    const b = shareOf(pay, [A, B], B);
    expect(b.totalAmount).toBe(0);
    expect(b.remaining).toBe(0);
    expect(b.paidAmount).toBe(0);
    expect(b.status).toBe("cancelled");
    const a = shareOf(pay, [A, B], A);
    expect(a.installments[0].amount).toBe(400_000);
    expect(a.totalAmount).toBe(1_000_000);
    expect(a.remaining).toBe(600_000);
  });

  it("when all orders are cancelled they are still split like active orders", () => {
    const x = order("x", "DNY7", 1_000_000, "cancelled");
    const y = order("y", "DNY7-1", 3_000_000, "cancelled");
    const pay = groupPayment([x, y], [installment("i1", 1_000_000, "2026-01-10")]);
    expect(shareOf(pay, [x, y], x).installments[0].amount).toBe(250_000);
    expect(shareOf(pay, [x, y], y).installments[0].amount).toBe(750_000);
  });
});
