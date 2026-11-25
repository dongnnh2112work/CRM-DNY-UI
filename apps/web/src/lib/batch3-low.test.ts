import { describe, expect, it } from "vitest";
import { countLabel } from "@/lib/count-label";
import {
  buildCustomerDeleteWarning,
  customerRelatedImpact,
} from "@/lib/customer-delete-warning";
import { summarizeCustomerImport } from "@/lib/customer-import";
import { formatVndDisplay } from "@/lib/format-vnd";
import { emailAddressIssue, trimmedNameIssue } from "@/lib/input-validators";
import { listFooterMode } from "@/lib/list-footer";
import { deadlineOmittedOnCreate } from "@/modules/orders/map-to-ui";
import { activeInstallmentCount, installmentCountLabel, paymentMethodMessageKey } from "@/lib/payment-display";
import { getPayrollScope, payrollSlipActor } from "@/lib/payroll";
import { runExclusive } from "@/lib/save-lock";
import { pathAfterLogin, safeReturnPath } from "@/lib/safe-return-path";
import { displayCategoryLabel } from "@/lib/service-category-label";
import { foldSearchText, matchesTableQuery } from "@/lib/table-search";
import { identityStatusToUi } from "@/modules/identity-admin/map-to-ui";
import type { AuthUser } from "@/modules/auth/api";

const activeUser: AuthUser = {
  id: "user-test",
  email: "test.bee@example.invalid",
  displayName: "TEST Bee",
  status: "ACTIVE",
  permissions: ["order.view"],
  roleCodes: ["STAFF"],
};

describe("batch 3 low helpers", () => {
  it("splits empty and invalid emails", () => {
    expect(emailAddressIssue("")).toBe("empty");
    expect(emailAddressIssue("   ")).toBe("empty");
    expect(emailAddressIssue("not-an-email")).toBe("invalid");
    expect(emailAddressIssue("test.bee@example.invalid")).toBeNull();
  });

  it("rejects whitespace-only names", () => {
    expect(trimmedNameIssue("   ")).toBe("empty");
    expect(trimmedNameIssue(" TEST Bee ")).toBeNull();
  });

  it("keeps return paths internal", () => {
    expect(safeReturnPath("/orders/ord-test")).toBe("/orders/ord-test");
    expect(safeReturnPath("/orders/ord-test?tab=pay")).toBe("/orders/ord-test?tab=pay");
    expect(safeReturnPath("//evil")).toBeNull();
    expect(safeReturnPath("https://evil.com")).toBeNull();
    expect(safeReturnPath("https://evil.com/orders")).toBeNull();
    expect(safeReturnPath("/\\evil")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeReturnPath("/not-a-crm-page")).toBeNull();
    expect(pathAfterLogin(activeUser, "/orders/ord-test")).toBe("/orders/ord-test");
    expect(pathAfterLogin(activeUser, "//evil")).toBe("/dashboard");
    expect(pathAfterLogin({ ...activeUser, status: "PENDING_APPROVAL", permissions: [], roleCodes: [] }, "/orders/x")).toBe(
      "/pending-approval",
    );
  });

  it("folds Vietnamese search text", () => {
    expect(foldSearchText("Hải Đông")).toBe("hai dong");
    expect(foldSearchText("Đôn")).toBe("don");
    expect(matchesTableQuery("dong", ["Hải Đông"])).toBe(true);
    expect(matchesTableQuery("Don", ["Đôn"])).toBe(true);
    expect(matchesTableQuery("xyz", ["Hải Đông"])).toBe(false);
  });

  it("formats VND with vi-VN grouping", () => {
    expect(formatVndDisplay(18_000_000)).toBe("18.000.000 ₫");
    expect(formatVndDisplay(600_000)).toBe("600.000 ₫");
  });

  it("counts only active installments and labels methods", () => {
    const rows = [{ status: "paid" }, { status: "cancelled" }, { status: "voided" }, { status: "pending" }];
    expect(activeInstallmentCount(rows)).toEqual({ active: 2, total: 4 });
    expect(installmentCountLabel(rows, (active, total) => `${active}/${total}`)).toBe("2/4");
    expect(installmentCountLabel([{ status: "paid" }], (active, total) => `${active}/${total}`)).toBe("1");
    expect(paymentMethodMessageKey("BANK_TRANSFER")).toBe("payment.bankTransfer");
    expect(paymentMethodMessageKey("CASH")).toBe("payment.cash");
    expect(paymentMethodMessageKey("QR_PAYMENT")).toBe("payment.qr");
  });

  it("warns when a TEST customer still has related records", () => {
    const impact = customerRelatedImpact("cust-test", [
      { customerId: "cust-test", contractId: "c1", contractNumber: "DH-1", contractStatus: "DRAFT" },
      { customerId: "cust-test", contractId: "c1", contractNumber: "DH-1", contractStatus: "DRAFT" },
      { customerId: "other", contractId: "c9", contractNumber: "100" },
    ]);
    expect(impact).toMatchObject({ orderCount: 2, contractCount: 1, draftContractCount: 1, hasRelated: true });
    const warning = buildCustomerDeleteWarning(
      impact,
      "Còn {orders} đơn và {contracts} hợp đồng liên quan (nháp: {drafts}).",
    );
    expect(warning).toContain("2");
    expect(warning).toContain("1");
    expect(warning).toContain("nháp");
    expect(buildCustomerDeleteWarning({ ...impact, orderCount: 0, contractCount: 0, draftContractCount: 0, hasRelated: false }, "x")).toBeNull();
  });

  it("does not pretend a create-time deadline was saved", () => {
    expect(deadlineOmittedOnCreate("2026-12-01")).toBe(true);
    expect(deadlineOmittedOnCreate("  ")).toBe(false);
    expect(deadlineOmittedOnCreate(undefined)).toBe(false);
  });

  it("separates blank import names from invalid rows", () => {
    const summary = summarizeCustomerImport([
      { Name: "   ", Phone: "0900000000" },
      { Name: "TEST Bee", Email: "not-an-email" },
      { Name: "", Phone: "", Email: "", Company: "" },
      { Name: "TEST Bee", Phone: "0900000000", Email: "test.bee@example.invalid" },
    ]);
    expect(summary).toEqual({ empty: 1, blankName: 1, invalid: 1, ok: 1 });
  });

  it("does not describe a filtered table as fully visible", () => {
    expect(listFooterMode(2, 13)).toBe("filtered");
    expect(listFooterMode(13, 13)).toBe("loaded");
  });

  it("uses the session user for payroll when the users store is still empty", () => {
    expect(getPayrollScope(null, null, ["commission.view"])).toBe("none");
    const actor = payrollSlipActor({
      storeUser: null,
      sessionUser: { id: "user-test", displayName: "TEST Bee", roleCodes: ["STAFF"] },
    });
    expect(getPayrollScope(actor, null, [])).toBe("self");
    expect(getPayrollScope(actor, null, ["commission.view"])).toBe("all");
  });

  it("clears the save lock after success and failure", async () => {
    const lock = { current: false };
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = runExclusive(lock, async () => {
      await gate;
      return "ok";
    });
    expect(lock.current).toBe(true);
    expect(await runExclusive(lock, async () => "second")).toBeUndefined();
    release();
    expect(await first).toBe("ok");
    expect(lock.current).toBe(false);
    await expect(
      runExclusive(lock, async () => {
        throw new Error("fail");
      }),
    ).rejects.toThrow("fail");
    expect(lock.current).toBe(false);
  });

  it("localises default category labels and leaves other labels", () => {
    const translate = (key: string) => (key === "service.category.other" ? "Khác" : key);
    expect(displayCategoryLabel("Other", translate)).toBe("Khác");
    expect(displayCategoryLabel("XYZ Corrp", translate)).toBe("XYZ Corrp");
  });

  it("pluralises a single file", () => {
    expect(countLabel(1, "1 file", "{count} files")).toBe("1 file");
    expect(countLabel(3, "1 file", "{count} files")).toBe("3 files");
  });

  it("maps pending approval separately from inactive", () => {
    expect(identityStatusToUi("PENDING_APPROVAL")).toBe("pending_approval");
    expect(identityStatusToUi("SUSPENDED")).toBe("inactive");
    expect(identityStatusToUi("ACTIVE")).toBe("active");
  });
});
