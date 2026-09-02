import type { MessageKey } from "@/lib/i18n";

export type HeaderSearchTarget = {
  placeholderKey: MessageKey;
  /** List path to apply `?q=`. Null when the current page has no searchable list. */
  listPath: string | null;
};

const MODULES: { prefix: string; listPath: string; placeholderKey: MessageKey }[] = [
  { prefix: "/orders", listPath: "/orders", placeholderKey: "shell.searchOrders" },
  { prefix: "/customers", listPath: "/customers", placeholderKey: "shell.searchCustomers" },
  { prefix: "/payments", listPath: "/payments", placeholderKey: "shell.searchPayments" },
  { prefix: "/expense-approvals", listPath: "/expense-approvals", placeholderKey: "shell.searchExpenses" },
  { prefix: "/vat", listPath: "/vat", placeholderKey: "shell.searchVat" },
  { prefix: "/services", listPath: "/services", placeholderKey: "shell.searchServices" },
  { prefix: "/emails", listPath: "/emails", placeholderKey: "shell.searchEmails" },
  { prefix: "/users", listPath: "/users", placeholderKey: "shell.searchUsers" },
];

export function getHeaderSearchTarget(pathname: string): HeaderSearchTarget {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return { placeholderKey: "shell.searchCustomers", listPath: "/customers" };
  }
  const hit = MODULES.filter(
    (m) => pathname === m.prefix || pathname.startsWith(`${m.prefix}/`),
  ).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (hit) return { placeholderKey: hit.placeholderKey, listPath: hit.listPath };
  return { placeholderKey: "shell.search", listPath: null };
}

export function listSearchHref(listPath: string, query: string) {
  const q = query.trim();
  if (!q) return listPath;
  return `${listPath}?q=${encodeURIComponent(q)}`;
}
