export type CustomerRelatedLink = {
  customerId: string;
  contractId?: string | null;
  contractNumber?: string | number | null;
  contractStatus?: string | null;
};

export type CustomerRelatedImpact = {
  orderCount: number;
  contractCount: number;
  draftContractCount: number;
  hasRelated: boolean;
};

function isDraftContract(status: string | null | undefined, contractNumber: string | number | null | undefined) {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "draft" || normalized === "nháp" || normalized === "nhap") return true;
  return String(contractNumber ?? "").trim().toUpperCase().startsWith("DH-");
}

/** Counts in-memory orders and contracts for one customer. Does not call the API. */
export function customerRelatedImpact(customerId: string, links: CustomerRelatedLink[]): CustomerRelatedImpact {
  const mine = links.filter((link) => link.customerId === customerId);
  const contracts = new Set<string>();
  const drafts = new Set<string>();
  for (const link of mine) {
    const contractId = link.contractId?.trim() || "";
    const contractNumber = String(link.contractNumber ?? "").trim();
    const contractKey = contractId || contractNumber;
    if (contractKey) contracts.add(contractKey);
    if (isDraftContract(link.contractStatus, contractNumber) && contractKey) drafts.add(contractKey);
  }
  return {
    orderCount: mine.length,
    contractCount: contracts.size,
    draftContractCount: drafts.size,
    hasRelated: mine.length > 0 || contracts.size > 0,
  };
}

export function sumCustomerRelatedImpact(impacts: CustomerRelatedImpact[]): CustomerRelatedImpact {
  const orderCount = impacts.reduce((sum, item) => sum + item.orderCount, 0);
  const contractCount = impacts.reduce((sum, item) => sum + item.contractCount, 0);
  const draftContractCount = impacts.reduce((sum, item) => sum + item.draftContractCount, 0);
  return {
    orderCount,
    contractCount,
    draftContractCount,
    hasRelated: orderCount > 0 || contractCount > 0,
  };
}

/** Fills {orders} {contracts} {drafts}. Returns null when there is nothing to warn about. */
export function buildCustomerDeleteWarning(
  impact: CustomerRelatedImpact,
  template: string,
): string | null {
  if (!impact.hasRelated) return null;
  return template
    .replaceAll("{orders}", String(impact.orderCount))
    .replaceAll("{contracts}", String(impact.contractCount))
    .replaceAll("{drafts}", String(impact.draftContractCount));
}
