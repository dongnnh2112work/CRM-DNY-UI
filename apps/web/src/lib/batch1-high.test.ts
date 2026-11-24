import { describe, expect, it } from "vitest";
import { changePasswordBody } from "@/modules/auth/change-password";
import {
  compareContractNumbers,
  contractNumberLabel,
  formatContractNumber,
  numericContractNumber,
} from "@/lib/contract-number";
import { OAUTH_LOCATION_STRIP_SCRIPT, OAUTH_PENDING_KEY } from "@/lib/http/oauth-redirect";
import { scopesForPath } from "@/lib/route-data-scopes";
import { uiSecurityHeaders } from "@/lib/security-headers";
import {
  collectOrderNumbers,
  placeholderContractNumber,
  proposeDossierNumbers,
  shouldDeleteOrphanContract,
} from "@/modules/orders/dossier-catalog";
import {
  applyContractSync,
  pickExistingContract,
  planContractSync,
  resolveContractForUnlinkedOrder,
} from "@/modules/orders/sync-contract";
import { buildVatDraftBody, buildVatDraftBodyForOrder } from "@/modules/vat/create-body";

const nov2026 = new Date(2026, 10, 24);

describe("H6 VAT draft body", () => {
  it("omits lines so the API is not sent an array", () => {
    const body = buildVatDraftBody({
      invoiceNumber: "VAT-TEST",
      orderId: "order-1",
      netAmount: 1000,
      vatAmount: 100,
      grossAmount: 1100,
      customerName: "TEST Bee",
      vatRate: 10,
    });
    expect(body).not.toHaveProperty("lines");
    expect(JSON.stringify(body)).not.toContain("lines");
    expect(body).toMatchObject({
      sourceType: "ORDER",
      netAmount: 1000,
      vatAmount: 100,
      grossAmount: 1100,
    });
  });
});

describe("VAT create guard", () => {
  const amounts = {
    invoiceNumber: "VAT-TEST",
    netAmount: 1000,
    vatAmount: 100,
    grossAmount: 1100,
    customerName: "TEST Bee",
    vatRate: 10,
  };

  it("does not build a create body for a cancelled order", () => {
    const blocked = buildVatDraftBodyForOrder({ id: "order-1", stage: "cancelled" }, amounts);
    expect(blocked).toEqual({ ok: false, reason: "cancelled" });
    if (blocked.ok) {
      throw new Error("cancelled order produced a VAT body");
    }
  });

  it("still builds a body without lines for an active order", () => {
    const allowed = buildVatDraftBodyForOrder({ id: "order-1", stage: "processing" }, amounts);
    expect(allowed.ok).toBe(true);
    if (!allowed.ok) return;
    expect(allowed.body).not.toHaveProperty("lines");
    expect(allowed.body.orderId).toBe("order-1");
    expect(buildVatDraftBody(allowed.body)).toEqual(allowed.body);
  });
});

describe("H5 contract numbers", () => {
  it("keeps DH- labels as text and only parses all-digit numbers", () => {
    expect(numericContractNumber("DH-1710000000000")).toBeUndefined();
    expect(formatContractNumber("DH-1710000000000")).toBe("DH-1710000000000");
    expect(numericContractNumber("990002")).toBe(990002);
    expect(contractNumberLabel("  990002  ")).toBe("990002");
    expect(numericContractNumber(0)).toBeUndefined();
    expect(numericContractNumber("0123")).toBeUndefined();
    expect(compareContractNumbers("DH-2", "990002")).not.toBeNaN();
  });

  it("does not skip a contract write when the order has no contract id", () => {
    expect(
      planContractSync({
        needsVat: true,
        submitted: "990002",
        contractId: undefined,
        previous: undefined,
        customerId: "cus-1",
      }).action,
    ).toBe("create");
  });

  it("updates when the number changed and skips when it did not", () => {
    expect(
      planContractSync({
        needsVat: true,
        submitted: 990002,
        contractId: "c1",
        previous: "990001",
        customerId: "cus-1",
      }),
    ).toMatchObject({ action: "update", contractId: "c1", contractNumber: "990002" });
    expect(
      planContractSync({
        needsVat: true,
        submitted: "990002",
        contractId: "c1",
        previous: "990002",
        customerId: "cus-1",
      }).action,
    ).toBe("skip");
  });

  it("reuses one exact contract and does not create another", async () => {
    const creates: string[] = [];
    const client = {
      async get() {
        throw new Error("no remembered id");
      },
      async list() {
        return {
          items: [
            { id: "c-keep", contractNumber: "990002", customerId: "cus-1" },
            { id: "c-other", contractNumber: "990003", customerId: "cus-1" },
          ],
          total: 2,
          pageSize: 50,
        };
      },
      async create(body: { contractNumber: string }) {
        creates.push(body.contractNumber);
        return { id: "should-not-run" };
      },
      async update() {
        throw new Error("no update");
      },
    };
    const decision = await resolveContractForUnlinkedOrder(client, {
      contractNumber: "990002",
      customerId: "cus-1",
      rememberedId: null,
    });
    expect(decision).toEqual({ action: "reuse", contractId: "c-keep", contractNumber: "990002" });
    if (decision.action !== "reuse") return;
    const applied = await applyContractSync(decision, client);
    expect(applied).toMatchObject({ ok: true, linked: false, contractId: "c-keep" });
    expect(creates).toEqual([]);
  });

  it("reuses the remembered contract by id after reload", async () => {
    let listed = false;
    const client = {
      async get(id: string) {
        return { id, contractNumber: "990002", customerId: "cus-1" };
      },
      async list() {
        listed = true;
        return { items: [], total: 0, pageSize: 50 };
      },
      async create() {
        throw new Error("create");
      },
      async update() {
        throw new Error("update");
      },
    };
    const decision = await resolveContractForUnlinkedOrder(client, {
      contractNumber: "990002",
      customerId: "cus-1",
      rememberedId: "c-remembered",
    });
    expect(decision).toEqual({
      action: "reuse",
      contractId: "c-remembered",
      contractNumber: "990002",
    });
    expect(listed).toBe(false);
    expect(pickExistingContract(
      [{ id: "c-remembered", contractNumber: "990002", customerId: "cus-1" }],
      "990002",
      "cus-1",
    )).toEqual({ kind: "unique", id: "c-remembered" });
  });

  it("blocks a second create when the existing contract cannot be identified", async () => {
    const creates: string[] = [];
    const client = {
      async get() {
        throw new Error("missing");
      },
      async list() {
        return {
          items: [
            { id: "c1", contractNumber: "990002", customerId: "cus-1" },
            { id: "c2", contractNumber: "990002", customerId: "cus-1" },
          ],
          total: 2,
          pageSize: 50,
        };
      },
      async create(body: { contractNumber: string }) {
        creates.push(body.contractNumber);
        return { id: "orphan" };
      },
      async update() {
        return undefined;
      },
    };
    const decision = await resolveContractForUnlinkedOrder(client, {
      contractNumber: "990002",
      customerId: "cus-1",
    });
    expect(decision).toEqual({ action: "blocked", reason: "ambiguous" });
    const applied = await applyContractSync({ action: "blocked" }, client);
    expect(applied.ok).toBe(false);
    expect(creates).toEqual([]);
  });

  it("creates only when the lookup is complete and no contract matches", async () => {
    const decision = await resolveContractForUnlinkedOrder(
      {
        async get() {
          throw new Error("none");
        },
        async list() {
          return { items: [], total: 0, pageSize: 50 };
        },
      },
      { contractNumber: "990002", customerId: "cus-1", title: "TEST Bee" },
    );
    expect(decision).toEqual({
      action: "create",
      contractNumber: "990002",
      customerId: "cus-1",
      title: "TEST Bee",
    });
  });

  it("blocks instead of creating when the contract lookup fails", async () => {
    const creates: string[] = [];
    const client = {
      async get() {
        throw new Error("missing");
      },
      async list() {
        throw new Error("contract.view failed");
      },
      async create(body: { contractNumber: string }) {
        creates.push(body.contractNumber);
        return { id: "orphan" };
      },
      async update() {
        return undefined;
      },
    };
    const decision = await resolveContractForUnlinkedOrder(client, {
      contractNumber: "990002",
      customerId: "cus-1",
    });
    expect(decision).toEqual({ action: "blocked", reason: "lookup-failed" });
    expect(creates).toEqual([]);
  });

  it("does not treat a failed plan as success", () => {
    expect(
      planContractSync({
        needsVat: true,
        submitted: "DH-1",
        contractId: "c1",
        customerId: "cus-1",
      }).action,
    ).toBe("invalid");
  });
});

describe("CL-C4 dossier numbers", () => {
  it("refuses to mint from an incomplete catalog", () => {
    expect(proposeDossierNumbers([], 1, nov2026, false)).toEqual({ ok: false, reason: "incomplete" });
  });

  it("mints the next November number from a complete catalog, not DNY261101 when later numbers exist", () => {
    expect(proposeDossierNumbers([], 1, nov2026, true)).toEqual({ ok: true, numbers: ["DNY261101"] });
    expect(
      proposeDossierNumbers(["DNY261104", "DNY261105-1", "DNY261001"], 2, nov2026, true),
    ).toEqual({ ok: true, numbers: ["DNY261106", "DNY261106-1"] });
  });

  it("pages until total is covered", async () => {
    const pages = [
      { items: [{ orderNumber: "DNY261101" }, { orderNumber: "DNY261102" }], total: 3, pageSize: 2 },
      { items: [{ orderNumber: "DNY261104" }], total: 3, pageSize: 2 },
    ];
    const loaded = await collectOrderNumbers(async (page) => pages[page - 1]);
    expect(loaded.complete).toBe(true);
    expect(loaded.orderNumbers).toEqual(["DNY261101", "DNY261102", "DNY261104"]);
    expect(shouldDeleteOrphanContract(0)).toBe(true);
    expect(shouldDeleteOrphanContract(1)).toBe(false);
    expect(placeholderContractNumber(1710000000000)).toBe("DH-1710000000000");
    expect(numericContractNumber(placeholderContractNumber(1710000000000))).toBeUndefined();
  });

  it("hydrates orders on the new-order and new-vat routes", () => {
    expect(scopesForPath("/orders/new")).toEqual(["orders"]);
    expect(scopesForPath("/vat/new")).toEqual(["orders"]);
    expect(scopesForPath("/customers/new")).toEqual([]);
  });
});

describe("H1 security headers", () => {
  it("sets CSP and the related UI headers without remote scripts", () => {
    const headers = uiSecurityHeaders({
      apiUrl: "https://apidyn.otcayxe.com/api/v1",
      nodeEnv: "production",
    });
    const byKey = Object.fromEntries(headers.map((header) => [header.key, header.value]));
    expect(byKey["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(byKey["Content-Security-Policy"]).toContain("connect-src 'self' https://apidyn.otcayxe.com");
    expect(byKey["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Permissions-Policy"]).toContain("camera=()");
  });
});

describe("H2 oauth url strip", () => {
  it("stashes tokens and replaceState without logging them", () => {
    expect(OAUTH_LOCATION_STRIP_SCRIPT).toContain(OAUTH_PENDING_KEY);
    expect(OAUTH_LOCATION_STRIP_SCRIPT).toContain("history.replaceState");
    expect(OAUTH_LOCATION_STRIP_SCRIPT).toContain("sessionStorage.setItem");
    expect(OAUTH_LOCATION_STRIP_SCRIPT).not.toContain("console.");
    expect(OAUTH_LOCATION_STRIP_SCRIPT).not.toContain("access_token=");
  });
});

describe("H4 change password body", () => {
  it("matches the agreed body and does not send currentPassword", () => {
    expect(changePasswordBody("new-secret-1")).toEqual({ newPassword: "new-secret-1" });
    expect(changePasswordBody("new-secret-1")).not.toHaveProperty("currentPassword");
  });
});
