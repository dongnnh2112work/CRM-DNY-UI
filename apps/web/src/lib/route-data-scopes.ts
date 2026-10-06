import { ROUTE_PAGE_SIZE } from "@/lib/http/paging";
import { PERMISSION } from "@/lib/rbac";

/** Background pages to pull before showing totals derived from a list. */
export const LIST_FILL_MAX_PAGES = 40;

export function isListSliceComplete(meta?: { total: number; loaded: number } | null): boolean {
  if (!meta) return false;
  if (meta.total === 0) return true;
  return meta.loaded >= meta.total;
}

/** True when this scope will not change the numbers again (done, forbidden, or fill cap). */
export function isListSliceSettled(
  meta: { total: number; loaded: number } | undefined,
  allowed: boolean,
): boolean {
  if (!allowed) return true;
  if (isListSliceComplete(meta)) return true;
  if (
    meta &&
    meta.loaded < meta.total &&
    meta.loaded >= ROUTE_PAGE_SIZE * LIST_FILL_MAX_PAGES
  ) {
    return true;
  }
  return false;
}

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

/**
 * In-memory rows older than this trigger a background refetch on navigation.
 * Raised from 30s → 90s to cut repeat list calls when switching sidebar tabs.
 */
export const FRESHNESS_MS = 90_000;

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

const UUID_SEG =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\/|$|\?)/i;

/** `/orders/:uuid`, `/customers/:uuid`, … — page loads its own aggregate/detail. */
export function isEntityDetailPath(pathname: string): boolean {
  const bases = ["/orders/", "/customers/", "/payments/", "/vat/", "/services/"];
  for (const base of bases) {
    if (pathname.startsWith(base) && UUID_SEG.test(pathname.slice(base.length))) return true;
  }
  return false;
}

/** Create forms — don't hydrate the parent list just to open the form. */
export function isEntityFormPath(pathname: string): boolean {
  return (
    pathname === "/orders/new" ||
    pathname === "/customers/new" ||
    pathname === "/vat/new" ||
    pathname === "/services/new" ||
    pathname.endsWith("/new")
  );
}

/**
 * Primary list scopes for a route. Dashboard is special-cased in ApiHydrator
 * (orders+payments preview, customers count-only).
 */
export function scopesForPath(pathname: string): RefreshScope[] {
  if (pathname.startsWith("/dashboard")) return [];
  // Detail pages use GET /:id or /:id/detail — skip list hydrate.
  if (isEntityDetailPath(pathname)) return [];
  // New forms don't need the list catalog on critical path.
  if (isEntityFormPath(pathname)) return [];

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

/** No deferred full catalogs — names come from BE JOIN on list/detail. */
export function deferredScopesForPath(_pathname: string): RefreshScope[] {
  return [];
}

export function primaryScopeForPath(pathname: string): RefreshScope | null {
  if (isEntityDetailPath(pathname) || isEntityFormPath(pathname)) return null;
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
