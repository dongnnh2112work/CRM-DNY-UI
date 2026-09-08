export type RefreshScope =
  | "all"
  | "core"
  | "deferred"
  | "users"
  | "customers"
  | "services"
  | "orders"
  | "payments"
  | "expenses"
  | "vat"
  | "notifications";

/** Catalogs needed in the shell (dropdowns, names, config). Not list pages. */
export const SHELL_SCOPES: RefreshScope[] = ["users", "services", "notifications"];

const STALE_MS: Partial<Record<RefreshScope, number>> = {
  notifications: 30_000,
  orders: 60_000,
  customers: 60_000,
  expenses: 60_000,
  payments: 60_000,
  vat: 120_000,
  services: 5 * 60_000,
  users: 5 * 60_000,
};

export function staleMsFor(scope: RefreshScope) {
  return STALE_MS[scope] ?? 60_000;
}

/** APIs this route actually renders. Nested paths share the parent list. */
export function scopesForPath(pathname: string): RefreshScope[] {
  if (pathname.startsWith("/customers")) return ["customers", "orders"];
  if (pathname.startsWith("/orders")) return ["orders", "customers"];
  if (pathname.startsWith("/payments")) return ["orders"];
  if (pathname.startsWith("/expense")) return ["expenses", "orders"];
  if (pathname.startsWith("/vat")) return ["vat", "orders"];
  if (pathname.startsWith("/services")) return ["services"];
  if (pathname.startsWith("/users")) return ["users"];
  if (pathname.startsWith("/payroll")) return ["orders", "expenses"];
  if (pathname.startsWith("/notifications")) return ["notifications"];
  if (pathname.startsWith("/dashboard")) return ["orders", "customers"];
  return [];
}

export function primaryScopeForPath(pathname: string): RefreshScope | null {
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/payments")) return "orders";
  if (pathname.startsWith("/expense")) return "expenses";
  if (pathname.startsWith("/vat")) return "vat";
  if (pathname.startsWith("/services")) return "services";
  if (pathname.startsWith("/users")) return "users";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/dashboard")) return "orders";
  if (pathname.startsWith("/payroll")) return "orders";
  return null;
}
