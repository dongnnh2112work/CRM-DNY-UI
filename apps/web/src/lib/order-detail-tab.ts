export const ORDER_DETAIL_TABS = ["expenses", "documents", "license", "notes"] as const;

export type OrderDetailTab = (typeof ORDER_DETAIL_TABS)[number];

/** `?tab=notes` opens Trao đổi when the viewer can see orders. */
export function resolveOrderDetailTab(
  requested: string | null | undefined,
  canViewNotes: boolean,
): OrderDetailTab {
  if (requested === "notes") return canViewNotes ? "notes" : "expenses";
  if (requested === "documents" || requested === "license" || requested === "expenses") {
    return requested;
  }
  return "expenses";
}
