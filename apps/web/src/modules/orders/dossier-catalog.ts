import { nextDossierNumber } from "@/lib/order-helpers";
import { splitDossierNumbers } from "@/lib/order-group";

export const DOSSIER_CATALOG_PAGE_SIZE = 100;
export const DOSSIER_CATALOG_MAX_PAGES = 40;

export type OrderNumberPage = {
  items?: Array<{ orderNumber?: string | null }> | null;
  total?: number;
  pageSize?: number;
};

/**
 * Page through orders until `total` is covered, or the page cap is hit.
 * An empty in-memory store must not be treated as "no orders exist".
 */
export async function collectOrderNumbers(
  loadPage: (page: number, pageSize: number) => Promise<OrderNumberPage>,
): Promise<{ orderNumbers: string[]; complete: boolean }> {
  const numbers: string[] = [];
  let total = Number.POSITIVE_INFINITY;
  for (let page = 1; page <= DOSSIER_CATALOG_MAX_PAGES; page += 1) {
    const res = await loadPage(page, DOSSIER_CATALOG_PAGE_SIZE);
    const items = res.items ?? [];
    if (typeof res.total === "number" && Number.isFinite(res.total)) total = res.total;
    for (const item of items) {
      const orderNumber = item.orderNumber?.trim();
      if (orderNumber) numbers.push(orderNumber);
    }
    const size = res.pageSize && res.pageSize > 0 ? res.pageSize : DOSSIER_CATALOG_PAGE_SIZE;
    if (items.length === 0 || numbers.length >= total || page * size >= total) {
      return { orderNumbers: numbers, complete: true };
    }
  }
  return { orderNumbers: numbers, complete: numbers.length >= total };
}

/** Mint dossier numbers only from a catalog that was fully loaded. */
export function proposeDossierNumbers(
  orderNumbers: string[],
  count: number,
  from: Date,
  complete: boolean,
): { ok: true; numbers: string[] } | { ok: false; reason: "incomplete" } {
  if (!complete) return { ok: false, reason: "incomplete" };
  const base = nextDossierNumber(
    orderNumbers.map((orderNumber) => ({ orderNumber })),
    from,
  );
  return { ok: true, numbers: splitDossierNumbers(base, Math.max(1, count)) };
}

/** Non-VAT contracts still need a unique string. Not parsed as a Số HĐ. */
export function placeholderContractNumber(now = Date.now()): string {
  return `DH-${now}`;
}

/** Delete a just-created draft only when no order was saved against it. */
export function shouldDeleteOrphanContract(createdOrderCount: number): boolean {
  return createdOrderCount === 0;
}
