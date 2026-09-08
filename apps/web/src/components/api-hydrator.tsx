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
  type ListSliceMeta,
  type RefreshScope,
} from "@/lib/load-api-data";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { useOrderStatusConfig } from "@/lib/order-status-store";
import { usePayments } from "@/lib/payments-store";
import { primaryScopeForPath, scopesForPath, staleMsFor } from "@/lib/route-data-scopes";
import { useServices } from "@/lib/services-store";
import { isAwaitingAccess } from "@/lib/access-gate";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useVat } from "@/lib/vat-store";

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
  const pageRef = useRef<Partial<Record<RefreshScope, number>>>({});
  const listMetaRef = useRef(listMeta);
  listMetaRef.current = listMeta;

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
    async (scope: RefreshScope | RefreshScope[], options?: { page?: number; append?: boolean }) => {
      if (status !== "authenticated" || isAwaitingAccess(user)) return;
      setRefreshing(true);
      try {
        await applyRemoteData(applier, user, scope, () => snapshotRef.current, options);
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
      } finally {
        setRefreshing(false);
      }
    },
    [applier, status, user],
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
    const scopes = scopesForPath(pathname);
    if (scopes.length === 0) {
      await refresh("core");
      return;
    }
    await refresh(scopes);
  }, [pathname, refresh]);

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
      await run("core");
      if (!cancelled) setReady(true);
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, user?.id, user?.status]);

  useEffect(() => {
    if (status !== "authenticated" || !ready) return;
    const scopes = scopesForPath(pathname);
    const now = Date.now();
    const due = scopes.filter((s) => {
      const at = fetchedAtRef.current[s];
      return at == null || now - at > staleMsFor(s);
    });
    if (due.length) void refresh(due);
  }, [pathname, status, ready, refresh]);

  useEffect(() => {
    if (status !== "authenticated" || !ready) return;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const scopes = scopesForPath(pathname);
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
      void run("notifications", { page: 1, append: false });
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
