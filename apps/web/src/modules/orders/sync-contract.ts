import { contractNumberLabel, numericContractNumber } from "@/lib/contract-number";

export type ContractWriteClient = {
  create(body: { contractNumber: string; customerId: string; title?: string }): Promise<{ id: string }>;
  update(id: string, body: { contractNumber: string }): Promise<unknown>;
};

export type ContractSyncPlan =
  | { action: "skip" }
  | { action: "invalid" }
  | { action: "blocked" }
  | { action: "reuse"; contractId: string; contractNumber: string }
  | { action: "update"; contractId: string; contractNumber: string }
  | { action: "create"; contractNumber: string; customerId: string; title?: string };

export type ContractLookupRow = {
  id: string;
  contractNumber?: string | null;
  customerId?: string | null;
};

export type ContractLookupClient = {
  get(id: string): Promise<ContractLookupRow>;
  list(query: {
    page?: number;
    pageSize?: number;
    search?: string;
    customerId?: string;
  }): Promise<{ items?: ContractLookupRow[] | null; total?: number; pageSize?: number }>;
};

const UNLINKED_CONTRACT_KEY = "dny-unlinked-contract:";
export const CONTRACT_LOOKUP_PAGE_SIZE = 50;
export const CONTRACT_LOOKUP_MAX_PAGES = 8;

/** Remember a contract we created but could not attach (order PATCH has no contractId). */
export function rememberUnlinkedContractId(orderId: string, contractId: string) {
  if (typeof sessionStorage === "undefined" || !orderId || !contractId) return;
  try {
    sessionStorage.setItem(UNLINKED_CONTRACT_KEY + orderId, contractId);
  } catch {
    /* ignore quota / private mode */
  }
}

export function rememberedUnlinkedContractId(orderId: string): string | null {
  if (typeof sessionStorage === "undefined" || !orderId) return null;
  try {
    const raw = sessionStorage.getItem(UNLINKED_CONTRACT_KEY + orderId)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

/**
 * Exact Số HĐ + customer. A number that belongs to someone else, or more than
 * one row, is not safe to reuse and must not trigger another create.
 */
export function pickExistingContract(
  rows: ContractLookupRow[],
  contractNumber: string,
  customerId: string,
): { kind: "unique"; id: string } | { kind: "none" } | { kind: "ambiguous" } {
  const want = contractNumberLabel(contractNumber);
  const customer = customerId.trim();
  if (!want || !customer) return { kind: "ambiguous" };
  const sameNumber = rows.filter((row) => row.id && contractNumberLabel(row.contractNumber) === want);
  const sameCustomer = sameNumber.filter((row) => row.customerId === customer);
  if (sameNumber.length === 1 && sameCustomer.length === 1) {
    return { kind: "unique", id: sameCustomer[0].id };
  }
  if (sameNumber.length === 0) return { kind: "none" };
  return { kind: "ambiguous" };
}

export async function loadContractsForLookup(
  list: ContractLookupClient["list"],
  query: { search: string; customerId: string },
): Promise<{ rows: ContractLookupRow[]; complete: boolean }> {
  const rows: ContractLookupRow[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let page = 1; page <= CONTRACT_LOOKUP_MAX_PAGES; page += 1) {
    const res = await list({
      page,
      pageSize: CONTRACT_LOOKUP_PAGE_SIZE,
      search: query.search,
      customerId: query.customerId,
    });
    const items = res.items ?? [];
    if (typeof res.total === "number" && Number.isFinite(res.total)) total = res.total;
    rows.push(...items);
    const size = res.pageSize && res.pageSize > 0 ? res.pageSize : CONTRACT_LOOKUP_PAGE_SIZE;
    if (items.length === 0 || rows.length >= total || items.length < size) {
      return { rows, complete: true };
    }
  }
  return { rows, complete: rows.length >= total };
}

export type UnlinkedContractDecision =
  | { action: "reuse"; contractId: string; contractNumber: string }
  | { action: "create"; contractNumber: string; customerId: string; title?: string }
  | { action: "blocked"; reason: "ambiguous" | "lookup-failed" };

/**
 * When the order has no contractId, find the draft already created for this
 * Số HĐ. Reuse one exact match. If the lookup is incomplete or ambiguous,
 * block — do not POST another contract.
 */
export async function resolveContractForUnlinkedOrder(
  client: ContractLookupClient,
  input: {
    contractNumber: string;
    customerId: string;
    title?: string;
    rememberedId?: string | null;
  },
): Promise<UnlinkedContractDecision> {
  const contractNumber = contractNumberLabel(input.contractNumber) ?? "";
  const customerId = input.customerId.trim();
  if (!contractNumber || !customerId) return { action: "blocked", reason: "lookup-failed" };

  const remembered = input.rememberedId?.trim();
  if (remembered) {
    try {
      const row = await client.get(remembered);
      const picked = pickExistingContract([row], contractNumber, customerId);
      if (picked.kind === "unique") {
        return { action: "reuse", contractId: picked.id, contractNumber };
      }
    } catch {
      /* stale id — fall through to the list */
    }
  }

  try {
    const loaded = await loadContractsForLookup(client.list.bind(client), {
      search: contractNumber,
      customerId,
    });
    if (!loaded.complete) return { action: "blocked", reason: "lookup-failed" };
    const picked = pickExistingContract(loaded.rows, contractNumber, customerId);
    if (picked.kind === "unique") return { action: "reuse", contractId: picked.id, contractNumber };
    if (picked.kind === "ambiguous") return { action: "blocked", reason: "ambiguous" };
    return { action: "create", contractNumber, customerId, title: input.title };
  } catch {
    return { action: "blocked", reason: "lookup-failed" };
  }
}

/**
 * Decide the contract write for a Số HĐ edit.
 * Skipping the call is only allowed when VAT is off, or the number is unchanged
 * on a contract that already exists. A missing contractId must create — never
 * pretend the order save stored the number.
 */
export function planContractSync(input: {
  needsVat: boolean;
  submitted?: string | number | null;
  contractId?: string | null;
  previous?: string | number | null;
  customerId: string;
  title?: string;
}): ContractSyncPlan {
  if (!input.needsVat) return { action: "skip" };
  const next = contractNumberLabel(input.submitted);
  if (!next || numericContractNumber(next) == null) return { action: "invalid" };
  const id = input.contractId?.trim();
  if (!id) {
    return {
      action: "create",
      contractNumber: next,
      customerId: input.customerId,
      title: input.title,
    };
  }
  if (contractNumberLabel(input.previous) === next) return { action: "skip" };
  return { action: "update", contractId: id, contractNumber: next };
}

export type ContractSyncResult =
  | { ok: true; linked: boolean; contractId?: string; contractNumber?: string }
  | { ok: false; error: unknown; contractId?: string };

export async function applyContractSync(
  plan: ContractSyncPlan,
  client: ContractWriteClient,
): Promise<ContractSyncResult> {
  if (plan.action === "invalid") {
    return { ok: false, error: new Error("invalid-contract-number") };
  }
  if (plan.action === "blocked") {
    return { ok: false, error: new Error("contract-link-blocked") };
  }
  if (plan.action === "skip") return { ok: true, linked: true };
  if (plan.action === "reuse") {
    return {
      ok: true,
      linked: false,
      contractId: plan.contractId,
      contractNumber: plan.contractNumber,
    };
  }
  if (plan.action === "update") {
    try {
      await client.update(plan.contractId, { contractNumber: plan.contractNumber });
      return {
        ok: true,
        linked: true,
        contractId: plan.contractId,
        contractNumber: plan.contractNumber,
      };
    } catch (error) {
      return { ok: false, error, contractId: plan.contractId };
    }
  }
  try {
    const created = await client.create({
      contractNumber: plan.contractNumber,
      customerId: plan.customerId,
      title: plan.title,
    });
    // UpdateOrderDto has no contractId. The new contract exists but is not
    // attached to the order until BE accepts that field.
    return {
      ok: true,
      linked: false,
      contractId: created.id,
      contractNumber: plan.contractNumber,
    };
  } catch (error) {
    return { ok: false, error };
  }
}
