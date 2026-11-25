export const ORDER_DETAIL_TABS = ["expenses", "documents", "license"] as const;

export type OrderDetailTab = (typeof ORDER_DETAIL_TABS)[number];

/** Inbox links still use `?tab=notes`; also accept `?tab=discussion`. */
export function isOrderDiscussionDeepLink(requested: string | null | undefined): boolean {
  return requested === "notes" || requested === "discussion";
}

/** Panel tabs only. Discussion is no longer a tab; deep links are handled separately. */
export function resolveOrderDetailTab(requested: string | null | undefined): OrderDetailTab {
  if (requested === "documents" || requested === "license" || requested === "expenses") {
    return requested;
  }
  return "expenses";
}
