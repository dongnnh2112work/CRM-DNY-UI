import { contractNumberLabel, numericContractNumber } from "@/lib/contract-number";

export type ContractWriteClient = {
  create(body: { contractNumber: string; customerId: string; title?: string }): Promise<{ id: string }>;
  update(id: string, body: { contractNumber: string }): Promise<unknown>;
};

export type ContractSyncPlan =
  | { action: "skip" }
  | { action: "invalid" }
  | { action: "update"; contractId: string; contractNumber: string }
  | { action: "create"; contractNumber: string; customerId: string; title?: string };

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
  if (plan.action === "skip") return { ok: true, linked: true };
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
