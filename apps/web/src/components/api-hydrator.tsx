"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { useCustomerStatusConfig } from "@/lib/customer-status-store";
import { useExpenses } from "@/lib/expenses-store";
import {
  applyRemoteData,
  clearEntityLookupCache,
  reloadOrderFinance,
  type ApplyRemoteOptions,
  type ListSliceMeta,
  type RefreshScope,
} from "@/lib/load-api-data";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import {
  canLoadScope,
  FRESHNESS_MS,
  LIST_FILL_MAX_PAGES,
  primaryScopeForPath,
  scopesForPath,
  staleMsFor,
} from "@/lib/route-data-scopes";
import { NOTIFICATION_PAGE_SIZE, ROUTE_PAGE_SIZE } from "@/lib/http/paging";
import { useServiceCategoryConfig } from "@/lib/service-category-store";
import { useServices } from "@/lib/services-store";
import { isAwaitingAccess } from "@/lib/access-gate";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useVat } from "@/lib/vat-store";

/** Share in-flight hydrate so React Strict Mode does not double-hit the API. */
const hydrateInflight = new Map<string, Promise<void>>();

/** Lists whose on-screen totals are sums over every row, not the current page. */
function aggregateFillScopes(pathname: string): RefreshScope[] {
  if (pathname.startsWith("/payroll")) return ["orders", "payments", "expenses"];
  if (pathname === "/orders") return ["payments", "expenses"];
  if (pathname === "/dashboard") return ["orders", "payments", "expenses"];
  if (pathname === "/vat") return ["vat"];
  return [];
}

function nameResolveForPath(pathname: string): ApplyRemoteOptions["nameResolve"] {
  if (pathname.startsWith("/dashboard")) return "dashboardPreview";
  // BE hydrates *Name on list (2026-10-06). listLean still feature-detects missing fields only.
  if (
    pathname.startsWith("/orders") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/expense") ||
    pathname.startsWith("/vat") ||
    pathname.startsWith("/payroll")
  ) {
    return "listLean";
  }
  return "full";
}

function deferIdle(fn: () => void) {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(() => fn(), { timeout: 2000 });
  } else {
    window.setTimeout(fn, 0);
  }
}

function hydrateKey(
  userId: string | undefined,
  scope: RefreshScope | RefreshScope[],
  options?: ApplyRemoteOptions,
) {
  const scopes = Array.isArray(scope) ? scope : [scope];
  return [
    userId ?? "",
    scopes.slice().sort().join(","),
    `p${options?.page ?? 1}`,
    `a${options?.append ? 1 : 0}`,
    `c${options?.countsOnly ? 1 : 0}`,
    `s${options?.pageSize ?? ""}`,
    `g${options?.loadConfig ? 1 : 0}`,
    `n${options?.nameResolve ?? "full"}`,
  ].join(":");
}

type ApiRefreshContextValue = {
  refresh: (scope?: RefreshScope | RefreshScope[]) => Promise<void>;
  refreshCurrent: () => Promise<void>;
  loadMore: (scope?: RefreshScope) => Promise<void>;
  invalidate: (scope?: RefreshScope | RefreshScope[]) => void;
  /** Warm list scopes for a path if never loaded / stale (sidebar hover). */
  prefetchPath: (path: string) => void;
  reloadOrderFinance: (
    orderId: string,
    opts?: { includeSchedule?: boolean; force?: boolean },
  ) => Promise<void>;
  ready: boolean;
  refreshing: boolean;
  /** True when in-memory rows for the primary route scope are within FRESHNESS_MS. */
  dataFresh: boolean;
  lastSyncedAt: number | null;
  listMeta: Partial<Record<RefreshScope, ListSliceMeta>>;
};

const ApiRefreshContext = createContext<ApiRefreshContextValue | null>(null);

function useApiRefreshContext() {
  const ctx = useContext(ApiRefreshContext);
  if (!ctx) throw new Error("useApiRefresh must be used within ApiHydrator");
  return ctx;
}

export function useApiRefresh() {
  return useApiRefreshContext().refresh;
}

export function useReloadOrderFinance() {
  return useApiRefreshContext().reloadOrderFinance;
}

export function useApiHydrate() {
  const ctx = useApiRefreshContext();
  return {
    ready: ctx.ready,
    refreshing: ctx.refreshing,
    dataFresh: ctx.dataFresh,
    lastSyncedAt: ctx.lastSyncedAt,
    listMeta: ctx.listMeta,
    refreshCurrent: ctx.refreshCurrent,
    loadMore: ctx.loadMore,
    invalidate: ctx.invalidate,
    prefetchPath: ctx.prefetchPath,
  };
}

export function useRemoteList(scope: RefreshScope) {
  const { listMeta, loadMore, refreshing } = useApiHydrate();
  const { user } = useSession();
  const meta = listMeta[scope];
  const allowed = canLoadScope(scope, user?.permissions);
  /** Waiting on first slice for a permitted scope — not empty-state. */
  const bootLoading = allowed && meta == null;
  const loaded = meta?.loaded ?? 0;
  return {
    loaded,
    total: meta?.total ?? 0,
    onLoadMore: () => {
      void loadMore(scope);
    },
    // Don't spin the table just because data is > FRESHNESS_MS old while rows are on screen.
    loading: bootLoading || (refreshing && loaded === 0),
    bootLoading,
  };
}

export function ApiHydrator({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status, user } = useSession();
  const { customers, replaceCustomers } = useCustomers();
  const { services, replaceServices } = useServices();
  const { orders, replaceOrders } = useOrders();
  const { ctvs, replaceCtvs } = useCtvs();
  const { expenses, replaceExpenses, mergeExpensesForOrder } = useExpenses();
  const { invoices, replaceInvoices } = useVat();
  const { payments, replacePayments, upsertPayment } = usePayments();
  const { replaceNotifications } = useNotifications();
  const { users, replaceUsers, mergeRemoteRoles, hydratePagePermissions, resetServerData, ensureSessionUser } =
    useUsers();
  const { hydrateConfig, resetServerData: resetReminders } = useAppReminderConfig();
  const { hydrateFromRemote: hydrateOrderStages } = useOrderStatusConfig();
  const { hydrateFromRemote: hydrateCustomerStatuses } = useCustomerStatusConfig();
  const { hydrateFromRemote: hydrateServiceCategories } = useServiceCategoryConfig();
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [listMeta, setListMetaState] = useState<Partial<Record<RefreshScope, ListSliceMeta>>>({});
  const [tick, setTick] = useState(0);

  const snapshotRef = useRef({ users, customers, services, ctvs, orders, payments, expenses, invoices });
  snapshotRef.current = { users, customers, services, ctvs, orders, payments, expenses, invoices };
  const fetchedAtRef = useRef<Partial<Record<RefreshScope, number>>>({});
  const forbiddenRef = useRef<Set<RefreshScope>>(new Set());
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const pageRef = useRef<Partial<Record<RefreshScope, number>>>({});
  const listMetaRef = useRef(listMeta);
  listMetaRef.current = listMeta;
  const refreshingDepthRef = useRef(0);
  const lastUserIdRef = useRef<string | undefined>(undefined);
  const configLoadedRef = useRef(false);

  const beginRefreshing = useCallback(() => {
    refreshingDepthRef.current += 1;
    setRefreshing(true);
  }, []);

  const endRefreshing = useCallback(() => {
    refreshingDepthRef.current = Math.max(0, refreshingDepthRef.current - 1);
    if (refreshingDepthRef.current === 0) setRefreshing(false);
  }, []);

  const setListMeta = useCallback((scope: RefreshScope, meta: ListSliceMeta) => {
    setListMetaState((prev) => ({ ...prev, [scope]: meta }));
    pageRef.current[scope] = meta.page;
  }, []);

  const resetAllStores = useCallback(() => {
    replaceOrders([]);
    replaceCustomers([]);
    replacePayments([]);
    replaceExpenses([]);
    replaceInvoices([]);
    replaceServices([]);
    replaceCtvs([]);
    replaceNotifications([]);
    resetServerData();
    resetReminders();
    clearEntityLookupCache();
    setListMetaState({});
    fetchedAtRef.current = {};
    forbiddenRef.current = new Set();
    pageRef.current = {};
    configLoadedRef.current = false;
    setLastSyncedAt(null);
  }, [
    replaceOrders,
    replaceCustomers,
    replacePayments,
    replaceExpenses,
    replaceInvoices,
    replaceServices,
    replaceCtvs,
    replaceNotifications,
    resetServerData,
    resetReminders,
  ]);

  const applier = useMemo(
    () => ({
      replaceUsers,
      mergeRemoteRoles,
      replaceCustomers,
      replaceServices,
      replaceCtvs,
      replaceOrders,
      replacePayments,
      replaceExpenses,
      replaceInvoices,
      replaceNotifications,
      hydrateConfig,
      hydrateOrderStages,
      hydrateCustomerStatuses,
      hydrateServiceCategories,
      hydratePagePermissions,
      setListMeta,
    }),
    [
      replaceUsers,
      mergeRemoteRoles,
      replaceCustomers,
      replaceServices,
      replaceCtvs,
      replaceOrders,
      replacePayments,
      replaceExpenses,
      replaceInvoices,
      replaceNotifications,
      hydrateConfig,
      hydrateOrderStages,
      hydrateCustomerStatuses,
      hydrateServiceCategories,
      hydratePagePermissions,
      setListMeta,
    ],
  );

  const filterAllowed = useCallback(
    (scopes: RefreshScope[]) =>
      scopes.filter(
        (s) =>
          !forbiddenRef.current.has(s) && canLoadScope(s, user?.permissions),
      ),
    [user?.permissions],
  );

  const run = useCallback(
    async (scope: RefreshScope | RefreshScope[], options?: ApplyRemoteOptions) => {
      if (status !== "authenticated" || isAwaitingAccess(user)) return;
      const raw = Array.isArray(scope) ? scope : [scope];
      const allowed = filterAllowed(raw.filter(Boolean) as RefreshScope[]);
      if (!allowed.length && !options?.loadConfig) return;

      const keyScopes = allowed.length ? allowed : (["core"] as RefreshScope[]);
      const key = hydrateKey(user?.id, keyScopes, options);
      const existing = hydrateInflight.get(key);
      beginRefreshing();
      try {
        if (existing) {
          await existing;
          return;
        }

        const pending = (async () => {
          await applyRemoteData(
            applier,
            user,
            allowed,
            () => snapshotRef.current,
            {
              ...options,
              onForbidden: (s) => {
                forbiddenRef.current.add(s);
                // End bootLoading so UI can show empty instead of spinning forever.
                setListMetaState((prev) =>
                  prev[s]
                    ? prev
                    : {
                        ...prev,
                        [s]: { total: 0, page: 1, pageSize: ROUTE_PAGE_SIZE, loaded: 0 },
                      },
                );
                options?.onForbidden?.(s);
              },
            },
          );
          if (options?.countsOnly || options?.abandonIf?.()) return;
          const now = Date.now();
          setLastSyncedAt(now);
          for (const s of allowed) {
            if (s === "all" || s === "core" || s === "deferred") continue;
            fetchedAtRef.current[s] = now;
          }
          if (options?.loadConfig) configLoadedRef.current = true;
        })().finally(() => {
          hydrateInflight.delete(key);
        });
        hydrateInflight.set(key, pending);
        await pending;
      } finally {
        endRefreshing();
      }
    },
    [applier, status, user, beginRefreshing, endRefreshing, filterAllowed],
  );

  const refresh = useCallback(
    async (scope: RefreshScope | RefreshScope[] = "core") => {
      const scopes = Array.isArray(scope) ? scope : [scope];
      for (const s of scopes) {
        pageRef.current[s] = 1;
        delete fetchedAtRef.current[s];
      }
      await run(scope, {
        page: 1,
        append: false,
        pageSize: ROUTE_PAGE_SIZE,
        nameResolve: nameResolveForPath(pathnameRef.current),
      });
    },
    [run],
  );

  const invalidate = useCallback((scope?: RefreshScope | RefreshScope[]) => {
    const scopes = scope
      ? Array.isArray(scope)
        ? scope
        : [scope]
      : (Object.keys(fetchedAtRef.current) as RefreshScope[]);
    for (const s of scopes) delete fetchedAtRef.current[s];
    setTick((n) => n + 1);
  }, []);

  const refreshCurrent = useCallback(async () => {
    if (pathname.startsWith("/dashboard")) {
      await Promise.all([
        run(["orders", "payments"], {
          pageSize: ROUTE_PAGE_SIZE,
          nameResolve: "dashboardPreview",
        }),
        run("customers", { countsOnly: true, pageSize: 1 }),
      ]);
      return;
    }
    const scopes = scopesForPath(pathname);
    if (scopes.length === 0) {
      if (canLoadScope("notifications", user?.permissions)) {
        await run("notifications", { pageSize: NOTIFICATION_PAGE_SIZE });
      }
      return;
    }
    await refresh(scopes);
  }, [pathname, refresh, run, user?.permissions]);

  const prefetchPath = useCallback(
    (path: string) => {
      if (status !== "authenticated" || isAwaitingAccess(user)) return;
      const scopes = filterAllowed(scopesForPath(path));
      if (!scopes.length) return;
      const due = scopes.filter((scope) => {
        const at = fetchedAtRef.current[scope];
        return at == null || Date.now() - at > staleMsFor(scope);
      });
      if (!due.length) return;
      void run(due, {
        page: 1,
        append: false,
        pageSize: ROUTE_PAGE_SIZE,
        nameResolve: nameResolveForPath(path),
      });
    },
    [status, user, filterAllowed, run],
  );

  const loadMore = useCallback(
    async (scope?: RefreshScope) => {
      const key = scope ?? primaryScopeForPath(pathname);
      if (!key) return;
      if (forbiddenRef.current.has(key) || !canLoadScope(key, user?.permissions)) return;
      const meta = listMetaRef.current[key];
      if (meta && meta.loaded >= meta.total) return;
      const next = (pageRef.current[key] ?? 1) + 1;
      await run(key, {
        page: next,
        append: true,
        pageSize: ROUTE_PAGE_SIZE,
        nameResolve: nameResolveForPath(pathnameRef.current),
      });
    },
    [pathname, run, user?.permissions],
  );

  const reloadFinance = useCallback(
    async (orderId: string, opts?: { includeSchedule?: boolean; force?: boolean }) => {
      const order = snapshotRef.current.orders.find((o) => o.id === orderId);
      if (!order) return;
      await reloadOrderFinance({
        order,
        groupOrders: snapshotRef.current.orders,
        users: snapshotRef.current.users,
        upsertPayment,
        mergeExpensesForOrder,
        includeSchedule: opts?.includeSchedule ?? true,
        force: opts?.force,
      });
      setLastSyncedAt(Date.now());
    },
    [upsertPayment, mergeExpensesForOrder],
  );

  // Account switch / logout — wipe stores so no stale rows leak.
  useEffect(() => {
    if (status !== "authenticated" || isAwaitingAccess(user)) {
      if (lastUserIdRef.current) {
        resetAllStores();
        lastUserIdRef.current = undefined;
      }
      setReady(false);
      return;
    }
    if (lastUserIdRef.current && lastUserIdRef.current !== user?.id) {
      resetAllStores();
    }
    lastUserIdRef.current = user?.id;
  }, [status, user?.id, user, resetAllStores]);

  // Seed session user into users-store (no user.manage → no /users list).
  useEffect(() => {
    if (status !== "authenticated" || !user || isAwaitingAccess(user)) return;
    let cancelled = false;
    void import("@/modules/identity-admin/map-to-ui").then(({ mapAuthUserToUi }) => {
      if (cancelled) return;
      ensureSessionUser(mapAuthUserToUi(user));
    });
    return () => {
      cancelled = true;
    };
  }, [status, user, ensureSessionUser]);

  // Boot once per authenticated user.
  useEffect(() => {
    if (status !== "authenticated" || isAwaitingAccess(user)) {
      setReady(false);
      return;
    }
    let cancelled = false;
    const boot = async () => {
      // Config (menu matrix / stages) — fire-and-forget; never blocks first list paint.
      if (!configLoadedRef.current) {
        void run([], { loadConfig: true }).catch(() => undefined);
      }

      const scheduleNotifs = () => {
        if (!canLoadScope("notifications", user?.permissions)) return;
        deferIdle(() => {
          if (cancelled) return;
          void run("notifications", { pageSize: NOTIFICATION_PAGE_SIZE });
        });
      };

      // Paint shell immediately; lists hydrate in background.
      setReady(true);

      if (pathnameRef.current.startsWith("/dashboard")) {
        await Promise.all([
          run(["orders", "payments"], {
            pageSize: ROUTE_PAGE_SIZE,
            nameResolve: "dashboardPreview",
            abandonIf: () => !pathnameRef.current.startsWith("/dashboard"),
          }),
          run("customers", { countsOnly: true, pageSize: 1 }),
        ]);
        if (cancelled) return;
        scheduleNotifs();
        return;
      }

      const pathScopes = filterAllowed(scopesForPath(pathnameRef.current));
      if (pathScopes.length) {
        await run(pathScopes, {
          pageSize: ROUTE_PAGE_SIZE,
          nameResolve: nameResolveForPath(pathnameRef.current),
        });
      }
      if (cancelled) return;
      scheduleNotifs();
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // Boot on auth identity only; navigation handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id]);

  // Route change — load primary scopes if stale or never loaded.
  useEffect(() => {
    if (status !== "authenticated" || !ready || isAwaitingAccess(user)) return;
    if (pathname.startsWith("/dashboard")) {
      const due = filterAllowed(["orders", "payments", "customers"]).filter((scope) => {
        const at = fetchedAtRef.current[scope];
        return at == null || Date.now() - at > staleMsFor(scope);
      });
      if (!due.length) return;
      if (due.includes("customers") && due.length === 1) {
        void run("customers", { countsOnly: true, pageSize: 1 });
        return;
      }
      void Promise.all([
        due.some((s) => s === "orders" || s === "payments")
          ? run(
              due.filter((s) => s === "orders" || s === "payments"),
              { pageSize: ROUTE_PAGE_SIZE, nameResolve: "dashboardPreview" },
            )
          : Promise.resolve(),
        due.includes("customers")
          ? run("customers", { countsOnly: true, pageSize: 1 })
          : Promise.resolve(),
      ]);
      return;
    }
    const due = filterAllowed(scopesForPath(pathname)).filter((scope) => {
      const at = fetchedAtRef.current[scope];
      return at == null || Date.now() - at > staleMsFor(scope);
    });
    if (due.length) void refresh(due);
  }, [pathname, status, ready, refresh, run, filterAllowed, user, tick]);

  // Keep paging lists that feed on-screen totals until the slice is complete.
  useEffect(() => {
    if (status !== "authenticated" || !ready || isAwaitingAccess(user)) return;
    const scopes = aggregateFillScopes(pathname).filter((s) => canLoadScope(s, user?.permissions));
    if (!scopes.length) return;
    let cancelled = false;
    void (async () => {
      for (const scope of scopes) {
        for (let i = 0; i < LIST_FILL_MAX_PAGES; i++) {
          if (cancelled) return;
          const meta = listMetaRef.current[scope];
          if (!meta) {
            await run(scope, {
              page: 1,
              append: false,
              pageSize: ROUTE_PAGE_SIZE,
              nameResolve: nameResolveForPath(pathnameRef.current),
            });
            if (cancelled || !listMetaRef.current[scope]) break;
            i -= 1;
            continue;
          }
          if (meta.loaded >= meta.total) break;
          await loadMore(scope);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, status, ready, loadMore, run, user]);

  // Notifications poll — only if permitted and not forbidden.
  useEffect(() => {
    if (status !== "authenticated" || !ready) return;
    if (!canLoadScope("notifications", user?.permissions)) return;
    if (forbiddenRef.current.has("notifications")) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (forbiddenRef.current.has("notifications")) return;
      const at = fetchedAtRef.current.notifications;
      if (at && Date.now() - at < staleMsFor("notifications")) return;
      void run("notifications", { page: 1, append: false, pageSize: NOTIFICATION_PAGE_SIZE });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [status, ready, run, user?.permissions]);

  const dataFresh = useMemo(() => {
    const scopes = pathname.startsWith("/dashboard")
      ? (["orders", "payments"] as RefreshScope[])
      : scopesForPath(pathname);
    if (!scopes.length) return true;
    const now = Date.now();
    return scopes.every((s) => {
      if (forbiddenRef.current.has(s) || !canLoadScope(s, user?.permissions)) return true;
      const at = fetchedAtRef.current[s];
      return at != null && now - at <= FRESHNESS_MS;
    });
    // tick forces recompute after invalidate
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user?.permissions, lastSyncedAt, tick, refreshing]);

  const ctx = useMemo(
    () => ({
      refresh,
      refreshCurrent,
      loadMore,
      invalidate,
      prefetchPath,
      reloadOrderFinance: reloadFinance,
      ready,
      refreshing,
      dataFresh,
      lastSyncedAt,
      listMeta,
    }),
    [
      refresh,
      refreshCurrent,
      loadMore,
      invalidate,
      prefetchPath,
      reloadFinance,
      ready,
      refreshing,
      dataFresh,
      lastSyncedAt,
      listMeta,
    ],
  );

  return <ApiRefreshContext.Provider value={ctx}>{children}</ApiRefreshContext.Provider>;
}
