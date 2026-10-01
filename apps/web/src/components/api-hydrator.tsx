"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { useCustomerStatusConfig } from "@/lib/customer-status-store";
import { useExpenses } from "@/lib/expenses-store";
import {
  applyRemoteData,
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
  deferredScopesForPath,
  primaryScopeForPath,
  scopesForPath,
  staleMsFor,
} from "@/lib/route-data-scopes";
import { NOTIFICATION_PAGE_SIZE, PREVIEW_PAGE_SIZE, LIST_PAGE_SIZE } from "@/lib/http/paging";
import { useServices } from "@/lib/services-store";
import { isAwaitingAccess } from "@/lib/access-gate";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useVat } from "@/lib/vat-store";

/** Share in-flight hydrate so React Strict Mode does not double-hit the API. */
const hydrateInflight = new Map<string, Promise<void>>();

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
  ].join(":");
}

type ApiRefreshContextValue = {
  refresh: (scope?: RefreshScope | RefreshScope[]) => Promise<void>;
  refreshCurrent: () => Promise<void>;
  loadMore: (scope?: RefreshScope) => Promise<void>;
  reloadOrderFinance: (orderId: string) => Promise<void>;
  ready: boolean;
  refreshing: boolean;
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
    lastSyncedAt: ctx.lastSyncedAt,
    listMeta: ctx.listMeta,
    refreshCurrent: ctx.refreshCurrent,
    loadMore: ctx.loadMore,
  };
}

export function useRemoteList(scope: RefreshScope) {
  const { listMeta, loadMore, refreshing } = useApiHydrate();
  const meta = listMeta[scope];
  if (!meta) return undefined;
  return {
    loaded: meta.loaded,
    total: meta.total,
    onLoadMore: () => {
      void loadMore(scope);
    },
    loading: refreshing,
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
  const { users, replaceUsers, mergeRemoteRoles, hydratePagePermissions } = useUsers();
  const { hydrateConfig } = useAppReminderConfig();
  const { hydrateFromRemote: hydrateOrderStages } = useOrderStatusConfig();
  const { hydrateFromRemote: hydrateCustomerStatuses } = useCustomerStatusConfig();
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const [listMeta, setListMetaState] = useState<Partial<Record<RefreshScope, ListSliceMeta>>>({});

  const snapshotRef = useRef({ users, customers, services, ctvs, orders, payments, expenses, invoices });
  snapshotRef.current = { users, customers, services, ctvs, orders, payments, expenses, invoices };
  const fetchedAtRef = useRef<Partial<Record<RefreshScope, number>>>({});
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const pageRef = useRef<Partial<Record<RefreshScope, number>>>({});
  const listMetaRef = useRef(listMeta);
  listMetaRef.current = listMeta;
  const refreshingDepthRef = useRef(0);

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
      hydratePagePermissions,
      setListMeta,
    ],
  );

  const run = useCallback(
    async (scope: RefreshScope | RefreshScope[], options?: ApplyRemoteOptions) => {
      if (status !== "authenticated" || isAwaitingAccess(user)) return;
      const key = hydrateKey(user?.id, scope, options);
      const existing = hydrateInflight.get(key);
      beginRefreshing();
      try {
        if (existing) {
          await existing;
          return;
        }

        const pending = (async () => {
          await applyRemoteData(applier, user, scope, () => snapshotRef.current, options);
          if (options?.countsOnly || options?.abandonIf?.()) return;
          const now = Date.now();
          setLastSyncedAt(now);
          const scopes = Array.isArray(scope) ? scope : [scope];
          for (const s of scopes) {
            if (s === "all" || s === "core" || s === "deferred") continue;
            fetchedAtRef.current[s] = now;
          }
          if (scopes.includes("core")) {
            fetchedAtRef.current.users = now;
            fetchedAtRef.current.services = now;
            fetchedAtRef.current.notifications = now;
          }
          if (scopes.includes("contracts")) {
            fetchedAtRef.current.contracts = now;
          }
        })().finally(() => {
          hydrateInflight.delete(key);
        });
        hydrateInflight.set(key, pending);
        await pending;
      } finally {
        endRefreshing();
      }
    },
    [applier, status, user, beginRefreshing, endRefreshing],
  );

  const refresh = useCallback(
    async (scope: RefreshScope | RefreshScope[] = "core") => {
      const scopes = Array.isArray(scope) ? scope : [scope];
      for (const s of scopes) pageRef.current[s] = 1;
      await run(scope, { page: 1, append: false });
    },
    [run],
  );

  const refreshCurrent = useCallback(async () => {
    if (pathname.startsWith("/dashboard")) {
      await run(["orders", "customers", "payments"], { countsOnly: true, pageSize: 1 });
      await run(["orders", "payments", "customers"], {
        pageSize: PREVIEW_PAGE_SIZE,
        abandonIf: () => !pathnameRef.current.startsWith("/dashboard"),
      });
      return;
    }
    const scopes = [...scopesForPath(pathname), ...deferredScopesForPath(pathname)];
    if (scopes.length === 0) {
      await run("notifications", { pageSize: NOTIFICATION_PAGE_SIZE, loadConfig: true });
      return;
    }
    await refresh(scopes);
  }, [pathname, refresh, run]);

  const loadMore = useCallback(
    async (scope?: RefreshScope) => {
      const key = scope ?? primaryScopeForPath(pathname);
      if (!key) return;
      const meta = listMetaRef.current[key];
      if (meta && meta.loaded >= meta.total) return;
      const next = (pageRef.current[key] ?? 1) + 1;
      await run(key, { page: next, append: true });
    },
    [pathname, run],
  );

  const reloadFinance = useCallback(
    async (orderId: string) => {
      const order = snapshotRef.current.orders.find((o) => o.id === orderId);
      if (!order) return;
      await reloadOrderFinance({
        order,
        groupOrders: snapshotRef.current.orders,
        users: snapshotRef.current.users,
        upsertPayment,
        mergeExpensesForOrder,
      });
      setLastSyncedAt(Date.now());
    },
    [upsertPayment, mergeExpensesForOrder],
  );

  useEffect(() => {
    if (status !== "authenticated" || isAwaitingAccess(user)) {
      setReady(false);
      fetchedAtRef.current = {};
      return;
    }
    let cancelled = false;
    setReady(false);
    const boot = async () => {
      if (pathname.startsWith("/dashboard")) {
        await run(["orders", "customers", "payments"], { countsOnly: true, pageSize: 1 });
        if (cancelled) return;
        setReady(true);
        void run(["orders", "payments", "customers"], {
          pageSize: PREVIEW_PAGE_SIZE,
          abandonIf: () => !pathnameRef.current.startsWith("/dashboard"),
        });
        void run("notifications", { pageSize: NOTIFICATION_PAGE_SIZE, loadConfig: true });
        return;
      }
      const pathScopes = scopesForPath(pathname);
      if (pathScopes.length) await run(pathScopes);
      if (cancelled) return;
      setReady(true);
      const deferred = deferredScopesForPath(pathname);
      if (deferred.length) void run(deferred);
      void run("notifications", { pageSize: NOTIFICATION_PAGE_SIZE, loadConfig: true });
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // Path scopes are read once at auth boot; later navigations use the pathname effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id, user?.status]);

  useEffect(() => {
    if (status !== "authenticated" || !ready) return;
    const now = Date.now();
    const due = [...scopesForPath(pathname), ...deferredScopesForPath(pathname)].filter((scope) => {
      const at = fetchedAtRef.current[scope];
      const stale = at == null || now - at > staleMsFor(scope);
      const meta = listMetaRef.current[scope];
      const listScope =
        scope === "orders" ||
        scope === "customers" ||
        scope === "payments" ||
        scope === "expenses" ||
        scope === "vat";
      const undersized =
        listScope &&
        Boolean(meta) &&
        meta!.page > 0 &&
        meta!.loaded < meta!.total &&
        meta!.pageSize < LIST_PAGE_SIZE;
      const neverLoaded = listScope && (!meta || meta.page === 0) && at == null;
      return stale || undersized || neverLoaded;
    });
    // One refresh batch — avoid parallel due + deferred streams.
    if (due.length) void refresh(due);
  }, [pathname, status, ready, refresh]);

  useEffect(() => {
    if (status !== "authenticated" || !ready) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const scopes = [...scopesForPath(pathname), ...deferredScopesForPath(pathname)];
      const now = Date.now();
      const due = (scopes.length ? scopes : (["notifications"] as RefreshScope[])).filter((s) => {
        const at = fetchedAtRef.current[s];
        return at == null || now - at > staleMsFor(s);
      });
      if (due.length) void refresh(due);
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const at = fetchedAtRef.current.notifications;
      if (at && Date.now() - at < staleMsFor("notifications")) return;
      void run("notifications", { page: 1, append: false, pageSize: NOTIFICATION_PAGE_SIZE });
    }, 30_000);
    return () => {
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [status, ready, pathname, refresh, run]);

  const ctx = useMemo(
    () => ({
      refresh,
      refreshCurrent,
      loadMore,
      reloadOrderFinance: reloadFinance,
      ready,
      refreshing,
      lastSyncedAt,
      listMeta,
    }),
    [refresh, refreshCurrent, loadMore, reloadFinance, ready, refreshing, lastSyncedAt, listMeta],
  );

  return <ApiRefreshContext.Provider value={ctx}>{children}</ApiRefreshContext.Provider>;
}
