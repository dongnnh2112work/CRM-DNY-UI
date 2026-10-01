import { PERMISSION } from "@/lib/rbac";

export type RefreshScope =
  | "all"
  | "core"
  | "deferred"
  | "users"
  | "customers"
  | "services"
  | "orders"
  | "payments"
  | "contracts"
  | "expenses"
  | "vat"
  | "notifications";

/** Capability required to call each list scope. Missing = no API call. */
export const SCOPE_PERMISSION: Partial<Record<RefreshScope, string>> = {
  orders: PERMISSION.orderView,
  payments: PERMISSION.paymentView,
  customers: PERMISSION.customerView,
  expenses: PERMISSION.expenseView,
  vat: PERMISSION.vatView,
  services: PERMISSION.serviceView,
  users: PERMISSION.userManage,
  notifications: PERMISSION.notificationViewOwn,
  /** Contracts / CTV names on order rows — gated by order.view */
  contracts: PERMISSION.orderView,
};

/** In-memory rows older than this must not be shown; refetch instead. */
export const FRESHNESS_MS = 30_000;

export function staleMsFor(_scope: RefreshScope) {
  return FRESHNESS_MS;
}

export function permissionForScope(scope: RefreshScope): string | null {
  return SCOPE_PERMISSION[scope] ?? null;
}

export function canLoadScope(
  scope: RefreshScope,
  permissions: string[] | undefined | null,
): boolean {
  const need = permissionForScope(scope);
  if (!need) return true;
  return Boolean(permissions?.includes(need));
}

/**
 * Primary list scopes for a route. Dashboard is special-cased in ApiHydrator
 * (orders+payments preview, customers count-only).
 */
export function scopesForPath(pathname: string): RefreshScope[] {
  if (pathname.startsWith("/dashboard")) return [];
  if (pathname.startsWith("/customers")) return ["customers"];
  if (pathname.startsWith("/orders")) return ["orders"];
  if (pathname.startsWith("/payments")) return ["payments"];
  if (pathname.startsWith("/expense")) return ["expenses"];
  if (pathname.startsWith("/vat")) return ["vat"];
  if (pathname.startsWith("/services")) return ["services"];
  if (pathname.startsWith("/users")) return ["users"];
  if (pathname.startsWith("/payroll")) return ["orders", "payments", "expenses"];
  if (pathname.startsWith("/notifications")) return ["notifications"];
  return [];
}

/** No deferred full catalogs — names resolve via GET /:id lookups. */
export function deferredScopesForPath(_pathname: string): RefreshScope[] {
  return [];
}

export function primaryScopeForPath(pathname: string): RefreshScope | null {
  if (pathname.startsWith("/customers")) return "customers";
  if (pathname.startsWith("/orders")) return "orders";
  if (pathname.startsWith("/payments")) return "payments";
  if (pathname.startsWith("/expense")) return "expenses";
  if (pathname.startsWith("/vat")) return "vat";
  if (pathname.startsWith("/services")) return "services";
  if (pathname.startsWith("/users")) return "users";
  if (pathname.startsWith("/notifications")) return "notifications";
  if (pathname.startsWith("/dashboard")) return "orders";
  if (pathname.startsWith("/payroll")) return "orders";
  return null;
}
