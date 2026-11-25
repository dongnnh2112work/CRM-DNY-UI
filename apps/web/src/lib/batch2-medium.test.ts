import { describe, expect, it } from "vitest";
import { buildOrderCashflow } from "@/lib/order-cashflow";
import {
  allocatePaymentShare,
  collectionState,
  contractMoneyView,
  presentGroupPayment,
  recalcPayment,
} from "@/lib/order-group";
import { orderAssigneeOptions } from "@/lib/assignee-options";
import { columnPrefsKey } from "@/lib/column-visibility";
import {
  commissionIssue,
  duplicatePendingExpense,
  duplicatePhoneCustomer,
  installmentAmountIssue,
  moneyAmountIssue,
  vnPhoneIssue,
  vnTaxIssue,
} from "@/lib/input-validators";
import { parsePage, PageShapeError } from "@/lib/page-result";
import { buildPayroll, orderSalary } from "@/lib/payroll";
import { isCancelledOnlyPayment, paymentsForCollection, upcomingCollectionPayments } from "@/lib/payment-visibility";
import { canReplaceRoleGroups, missingViewPermissions } from "@/lib/permission-consistency";
import { expenseReviewBlock } from "@/lib/rbac";
import { rowsFromXlsx, rowsToXlsxBuffer } from "@/lib/spreadsheet";
import type { Order, OrderExpense, PaymentInstallment, PaymentRecord } from "@/lib/types";

function order(partial: Partial<Order> & Pick<Order, "id" | "orderNumber" | "value">): Order {
  return {
    customerId: "cus-test",
    customerName: "TEST Bee",
    serviceId: "svc-test",
    serviceName: "TEST Service",
    stage: "processing",
    channel: "direct",
    commissionPercent: 10,
    assignedUserId: "user-test",
    assignedUserName: "TEST Bee",
    submitterId: "user-test",
    submitterName: "TEST Bee",
    attachments: [],
    licenseAttachments: [],
    approvalStatus: "none",
    approvalHistory: [],
    createdAt: "2026-01-01",
    month: "2026-01",
    needsVat: false,
    contractId: "contract-test",
    ...partial,
  };
}

function installment(
  id: string,
  amount: number,
  dueDate: string,
  status: PaymentInstallment["status"] = "paid",
  paidDate?: string,
): PaymentInstallment {
  return { id, amount, dueDate, status, paidDate: paidDate ?? (status === "paid" ? dueDate : undefined) };
}

function pay(siblings: Order[], installments: PaymentInstallment[]): PaymentRecord {
  const total = siblings.reduce((sum, row) => sum + Math.max(0, row.value), 0);
  return recalcPayment({
    id: "pay-test",
    orderId: siblings[0].id,
    orderNumber: siblings[0].orderNumber,
    customerId: "cus-test",
    customerName: "TEST Bee",
    totalAmount: total,
    paidAmount: 0,
    remaining: 0,
    status: "unpaid",
    installments,
    groupedOrderIds: siblings.map((row) => row.id),
  });
}

function expense(partial: Partial<OrderExpense> & Pick<OrderExpense, "id" | "orderId" | "amount">): OrderExpense {
  return {
    projectName: "TEST project",
    title: "TEST expense",
    requestedById: "user-test",
    requestedByName: "TEST Bee",
    requestedAt: "2026-01-20",
    payeeName: "TEST Payee",
    bankAccount: "000111222",
    bankName: "TEST Bank",
    status: "approved",
    reviewedAt: "2026-01-21",
    ...partial,
  };
}

describe("M15 cancel does not move paid receipts or raise payroll", () => {
  const beforeA = order({ id: "a", orderNumber: "DNY-T1", value: 1_000_000 });
  const beforeB = order({ id: "b", orderNumber: "DNY-T1-1", value: 1_000_000, serviceName: "TEST Service B" });
  const group = pay([beforeA, beforeB], [installment("i1", 1_000_000, "2026-01-15")]);
  const spent = expense({ id: "e1", orderId: "a", amount: 200_000 });

  it("keeps the paid split after one service is cancelled", () => {
    const cancelledA = { ...beforeA, stage: "cancelled" };
    const siblings = [cancelledA, beforeB];
    const shareA = allocatePaymentShare(group, cancelledA, siblings);
    const shareB = allocatePaymentShare(group, beforeB, siblings);
    expect(shareA?.installments[0].amount).toBe(500_000);
    expect(shareA?.status).toBe("cancelled");
    expect(shareB?.installments[0].amount).toBe(500_000);
    expect(shareB?.paidAmount).toBe(500_000);
    expect(shareB?.totalAmount).toBe(1_000_000);
    expect(collectionState(shareB!.paidAmount, shareB!.totalAmount, shareB!.installments).collectedInFull).toBe(false);
    const view = contractMoneyView(group, siblings);
    expect(view.contractTotal).toBe(1_000_000);
    expect(view.allocatedPaid).toBe(500_000);
    expect(view.cashPaid).toBe(1_000_000);
    expect(view.collectedInFull).toBe(false);
    expect(view.contractRemaining).toBe(500_000);
    expect(presentGroupPayment(group, siblings).status).not.toBe("paid");
  });

  it("does not increase salary when the cancelled order's expense would otherwise drop out", () => {
    const open = buildPayroll([beforeA, beforeB], [group], [spent], "2026-01");
    const cancelledA = { ...beforeA, stage: "cancelled" };
    const after = buildPayroll([cancelledA, beforeB], [group], [spent], "2026-01");
    expect(open).toHaveLength(1);
    expect(after).toHaveLength(1);
    expect(after[0].total).toBe(open[0].total);
    expect(after[0].total).toBe(80_000);
    const lineA = after[0].lines.find((line) => line.orderId === "a");
    const lineB = after[0].lines.find((line) => line.orderId === "b");
    expect(lineA).toMatchObject({ thu: 500_000, chi: 200_000, salary: 30_000 });
    expect(lineB).toMatchObject({ thu: 500_000, chi: 0, salary: 50_000 });
  });
});

describe("CL-M18 verified installments stay frozen when a service is added", () => {
  it("gives the new TEST service none of the earlier payment and leaves that month's payroll unchanged", () => {
    const a = order({ id: "a", orderNumber: "DNY-T2", value: 1_000_000, createdAt: "2026-01-01" });
    const b = order({
      id: "b",
      orderNumber: "DNY-T2-1",
      value: 1_000_000,
      createdAt: "2026-01-01",
      serviceName: "TEST Service B",
    });
    const early = pay([a, b], [installment("i1", 1_000_000, "2026-01-10", "paid", "2026-01-10")]);
    const before = buildPayroll([a, b], [early], [], "2026-01");
    const c = order({
      id: "c",
      orderNumber: "DNY-T2-2",
      value: 1_000_000,
      createdAt: "2026-02-01",
      serviceName: "TEST Service C",
    });
    const siblings = [a, b, c];
    const later = {
      ...early,
      groupedOrderIds: siblings.map((row) => row.id),
      installments: [
        ...early.installments,
        installment("i2", 300_000, "2026-02-15", "paid", "2026-02-15"),
      ],
    };
    const shareA = allocatePaymentShare(later, a, siblings);
    const shareC = allocatePaymentShare(later, c, siblings);
    expect(shareA?.installments.map((row) => row.amount)).toEqual([500_000, 100_000]);
    expect(shareC?.installments.map((row) => row.amount)).toEqual([0, 100_000]);
    const january = buildPayroll(siblings, [later], [], "2026-01");
    expect(january[0].total).toBe(before[0].total);
    expect(january[0].lines.find((line) => line.orderId === "c")).toBeUndefined();
    const february = buildPayroll(siblings, [later], [], "2026-02");
    expect(february[0].lines.find((line) => line.orderId === "c")?.thu).toBe(100_000);
  });
});

describe("M18 collected-in-full and contract labels", () => {
  it("does not call a contract collected in full while a pending installment remains", () => {
    const a = order({ id: "a", orderNumber: "DNY-T3", value: 1_000_000 });
    const record = pay([a], [
      installment("i1", 1_000_000, "2026-01-10"),
      installment("i2", 100_000, "2026-03-10", "pending"),
    ]);
    const view = contractMoneyView(record, [a]);
    expect(view.collectedInFull).toBe(false);
    expect(view.open).toBe(true);
    expect(presentGroupPayment(record, [a]).status).not.toBe("paid");
  });

  it("warns on overpay instead of collected-in-full", () => {
    const a = order({ id: "a", orderNumber: "DNY-T4", value: 1_000_000 });
    const b = order({ id: "b", orderNumber: "DNY-T4-1", value: 1_000_000 });
    const record = pay([a, b], [installment("i1", 3_000_000, "2026-01-10")]);
    const view = contractMoneyView(record, [a, b]);
    expect(view.contractTotal).toBe(2_000_000);
    expect(view.overpaid).toBe(true);
    expect(view.collectedInFull).toBe(false);
    expect(view.contractRemaining).toBeLessThan(0);
  });

  it("labels contract remaining separately from one order's share", () => {
    const a = order({ id: "a", orderNumber: "DNY-T5", value: 1_000_000 });
    const b = order({ id: "b", orderNumber: "DNY-T5-1", value: 3_000_000 });
    const record = pay([a, b], [installment("i1", 1_000_000, "2026-01-10")]);
    const view = contractMoneyView(record, [a, b]);
    const shareA = allocatePaymentShare(record, a, [a, b]);
    expect(view.contractTotal).toBe(4_000_000);
    expect(view.contractRemaining).toBe(3_000_000);
    expect(shareA?.remaining).not.toBe(view.contractRemaining);
    expect(shareA?.totalAmount).toBe(1_000_000);
  });
});

describe("M19 cancelled orders stay off collection lists", () => {
  const cancelled = order({ id: "x", orderNumber: "DNY-X", value: 500_000, stage: "cancelled" });
  const live = order({ id: "y", orderNumber: "DNY-Y", value: 500_000, contractId: "other" });
  const deadPay = presentGroupPayment(pay([cancelled], [installment("i1", 100_000, "2026-04-01", "pending")]), [
    cancelled,
  ]);
  const livePay = presentGroupPayment(pay([live], [installment("i2", 100_000, "2026-04-01", "pending")]), [live]);

  it("drops a cancelled-only TEST order from payments and upcoming", () => {
    expect(isCancelledOnlyPayment(deadPay, [cancelled, live])).toBe(true);
    expect(paymentsForCollection([deadPay, livePay], [cancelled, live]).map((row) => row.id)).toEqual([livePay.id]);
    expect(upcomingCollectionPayments([deadPay, livePay], [cancelled, live]).map((row) => row.id)).toEqual([
      livePay.id,
    ]);
  });
});

describe("CL-M6 payroll display of commission", () => {
  it("does not treat a missing percent as a quiet zero and keeps a negative net", () => {
    expect(orderSalary(undefined, 100_000)).toBeNull();
    expect(orderSalary(10, -50_000)).toBe(-5_000);
    const row = order({ id: "a", orderNumber: "DNY-T6", value: 1_000_000, commissionPercent: undefined });
    const record = pay([row], [installment("i1", 100_000, "2026-01-10")]);
    const spent = expense({ id: "e1", orderId: "a", amount: 400_000 });
    const missing = buildPayroll([row], [record], [], "2026-01");
    expect(missing[0].lines[0].commissionMissing).toBe(true);
    expect(missing[0].lines[0].salary).toBeNull();
    expect(missing[0].total).toBe(0);
    const negative = buildPayroll([{ ...row, commissionPercent: 10 }], [record], [spent], "2026-01");
    expect(negative[0].lines[0].net).toBe(-300_000);
    expect(negative[0].lines[0].salary).toBe(-30_000);
    expect(negative[0].total).toBe(-30_000);
  });

  it("cashflow month uses the frozen share, not the whole contract receipt", () => {
    const a = order({ id: "a", orderNumber: "DNY-T7", value: 1_000_000 });
    const b = order({ id: "b", orderNumber: "DNY-T7-1", value: 1_000_000, stage: "cancelled" });
    const record = pay([a, b], [installment("i1", 1_000_000, "2026-01-10")]);
    const flow = buildOrderCashflow(allocatePaymentShare(record, a, [a, b]), []);
    expect(flow.thu).toBe(500_000);
  });
});

describe("batch 2 validators and shell helpers", () => {
  it("blocks 0 and negative order values without clamping", () => {
    expect(moneyAmountIssue(0)).toBe("not_positive");
    expect(moneyAmountIssue(-1000)).toBe("negative");
    expect(moneyAmountIssue(1)).toBeNull();
    expect(installmentAmountIssue(0, 1000)).toBe("not_positive");
    expect(installmentAmountIssue(1500, 1000)).toBe("over_remaining");
    expect(installmentAmountIssue(900, 600, { amount: 400, status: "paid" })).toBeNull();
  });

  it("requires commission and keeps 100% while warning on unconfirmed 0", () => {
    expect(commissionIssue("")).toBe("missing");
    expect(commissionIssue(0, false)).toBe("zero_unconfirmed");
    expect(commissionIssue(0, true)).toBeNull();
    expect(commissionIssue(100, false)).toBeNull();
    expect(commissionIssue(101)).toBe("range");
  });

  it("validates TEST phone and tax, and warns on a duplicate loaded phone", () => {
    expect(vnPhoneIssue("abc123")).toBe("invalid");
    expect(vnPhoneIssue("123")).toBe("invalid");
    expect(vnPhoneIssue("0901234567")).toBeNull();
    expect(vnTaxIssue("123")).toBe("invalid");
    expect(vnTaxIssue("0123456787")).toBeNull();
    const dup = duplicatePhoneCustomer("+84901234567", [
      { id: "c1", name: "TEST Bee", phone: "0901234567" },
    ]);
    expect(dup?.name).toBe("TEST Bee");
    expect(duplicatePhoneCustomer("0901234567", [{ id: "c1", name: "TEST Bee", phone: "0901234567" }], "c1")).toBeUndefined();
  });

  it("hides self-approval and flags a duplicate pending expense", () => {
    expect(
      expenseReviewBlock({
        hasExpenseApprovePermission: true,
        currentUserId: "u1",
        requestedById: "u1",
      }),
    ).toBe("own_request");
    expect(
      expenseReviewBlock({
        hasExpenseApprovePermission: true,
        currentUserId: "u2",
        requestedById: "u1",
      }),
    ).toBe("ok");
    const pending = expense({ id: "e1", orderId: "a", amount: 50_000, status: "pending" });
    expect(duplicatePendingExpense([pending], { orderId: "a", amount: 50_000, payeeName: "TEST Payee" })?.id).toBe("e1");
    expect(duplicatePendingExpense([pending], { orderId: "a", amount: 50_000, payeeName: "Other" })).toBeUndefined();
  });

  it("keeps column prefs and assignee options per user, including super admin", () => {
    expect(columnPrefsKey("orders", "user-a")).not.toBe(columnPrefsKey("orders", "user-b"));
    expect(columnPrefsKey("orders", "user-a")).toContain("user-a");
    const options = orderAssigneeOptions(
      [
        { id: "sa", name: "TEST Super", status: "active", role: "super_admin" },
        { id: "st", name: "TEST Staff", status: "active", role: "staff" },
        { id: "off", name: "TEST Off", status: "inactive", role: "admin" },
      ],
      [{ assignedUserId: "gone", assignedUserName: "TEST Assigned" }],
    );
    expect(options.map((row) => row.value)).toEqual(["gone", "sa", "st"].sort((a, b) => {
      const labels: Record<string, string> = { gone: "TEST Assigned", sa: "TEST Super", st: "TEST Staff" };
      return labels[a].localeCompare(labels[b], "vi");
    }));
  });

  it("parses email template pages and rejects an unexpected shape", () => {
    expect(parsePage<{ id: string }>([{ id: "t1" }]).items).toEqual([{ id: "t1" }]);
    expect(parsePage([{ id: "t2" }]).total).toBe(1);
    expect(parsePage({ items: [{ id: "t3" }], total: 4, page: 2, pageSize: 1 }).page).toBe(2);
    expect(parsePage({ data: { results: [{ id: "t4" }], totalCount: 8 } }).items).toEqual([{ id: "t4" }]);
    expect(() => parsePage({ unexpected: true })).toThrow(PageShapeError);
  });

  it("warns when a permission group can mutate without view and will not save unknown groups", () => {
    expect(missingViewPermissions(["order.update", "order.view"])).toEqual([]);
    expect(missingViewPermissions(["expense.approve"])).toEqual([
      { resource: "expense", mutate: ["expense.approve"] },
    ]);
    expect(canReplaceRoleGroups({ groupsKnown: false, draftCodes: [], loadedCodes: [] })).toBe(false);
    expect(canReplaceRoleGroups({ groupsKnown: true, draftCodes: [], loadedCodes: ["SALES"] })).toBe(true);
  });

  it("round-trips a TEST spreadsheet row without the community xlsx package", async () => {
    const buffer = await rowsToXlsxBuffer([{ Name: "TEST Bee", Phone: "0900000001" }]);
    const rows = await rowsFromXlsx(buffer);
    expect(rows).toEqual([{ Name: "TEST Bee", Phone: "0900000001" }]);
  });
});
