"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppReminderConfig } from "@/lib/app-config-store";
import { useCustomers } from "@/lib/customers-store";
import { useCtvs } from "@/lib/ctvs-store";
import { useExpenses } from "@/lib/expenses-store";
import { applyRemoteData, reloadOrderFinance, type RefreshScope } from "@/lib/load-api-data";
import { useNotifications } from "@/lib/notifications-store";
import { useOrders } from "@/lib/orders-store";
import { usePayments } from "@/lib/payments-store";
import { useServices } from "@/lib/services-store";
import { useSession } from "@/lib/session/session-provider";
import { useUsers } from "@/lib/users-store";
import { useVat } from "@/lib/vat-store";

type ApiRefreshContextValue = {
  refresh: (scope?: RefreshScope | RefreshScope[]) => Promise<void>;
  reloadOrderFinance: (orderId: string) => Promise<void>;
  ready: boolean;
  refreshing: boolean;
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
  return { ready: ctx.ready, refreshing: ctx.refreshing };
}

export function ApiHydrator({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const { customers, replaceCustomers } = useCustomers();
  const { services, replaceServices } = useServices();
  const { orders, replaceOrders } = useOrders();
  const { ctvs, replaceCtvs } = useCtvs();
  const { replaceExpenses, mergeExpensesForOrder } = useExpenses();
  const { replaceInvoices } = useVat();
  const { replacePayments, upsertPayment } = usePayments();
  const { replaceNotifications } = useNotifications();
  const { users, replaceUsers, mergeRemoteRoles } = useUsers();
  const { hydrateConfig } = useAppReminderConfig();
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const snapshotRef = useRef({ users, customers, services, ctvs, orders });
  snapshotRef.current = { users, customers, services, ctvs, orders };

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
    ],
  );

  const refresh = useCallback(
    async (scope: RefreshScope | RefreshScope[] = "core") => {
      if (status !== "authenticated") return;
      setRefreshing(true);
      try {
        await applyRemoteData(applier, user, scope, () => snapshotRef.current);
      } finally {
        setRefreshing(false);
      }
    },
    [applier, status, user],
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
    },
    [upsertPayment, mergeExpensesForOrder],
  );

  useEffect(() => {
    if (status !== "authenticated") {
      setReady(false);
      return;
    }
    let cancelled = false;
    setReady(false);
    setRefreshing(true);
    const run = async () => {
      await applyRemoteData(applier, user, "core", () => snapshotRef.current);
      if (cancelled) return;
      setReady(true);
      void applyRemoteData(applier, user, "deferred", () => snapshotRef.current);
    };
    void run().finally(() => {
      if (!cancelled) setRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const ctx = useMemo(
    () => ({ refresh, reloadOrderFinance: reloadFinance, ready, refreshing }),
    [refresh, reloadFinance, ready, refreshing],
  );

  return <ApiRefreshContext.Provider value={ctx}>{children}</ApiRefreshContext.Provider>;
}
