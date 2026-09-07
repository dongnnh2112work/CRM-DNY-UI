"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tt } from "@/lib/i18n";
import { orderJobOwnerIds, relatedUserIds, type NotificationDraft } from "@/lib/notification-targets";
import { daysUntil, getOrderLicenseExpirySummary, licenseWarnMonthsOf } from "@/lib/order-helpers";
import type { AppNotification, Order, Service } from "@/lib/types";
import { notificationsApi } from "@/modules/notifications/api";

type AddInput = NotificationDraft & { userId: string };

type Ctx = {
  notifications: AppNotification[];
  ready: boolean;
  addNotification: (input: AddInput) => AppNotification | null;
  addNotifications: (
    userIds: Array<string | undefined | null>,
    draft: NotificationDraft,
    exceptUserId?: string,
  ) => void;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  unreadCount: (userId: string) => number;
  forUser: (userId: string) => AppNotification[];
  scanOrderAlerts: (
    orders: Order[],
    opts: {
      services: Array<Pick<Service, "id" | "licenseExpiryWarnMonths">>;
      vatWarnDays: number;
    },
  ) => AppNotification[];
  replaceNotifications: (items: AppNotification[]) => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const replaceNotifications = useCallback((items: AppNotification[]) => {
    setNotifications(items);
  }, []);

  const addNotifications = useCallback(
    (userIds: Array<string | undefined | null>, draft: NotificationDraft, exceptUserId?: string) => {
      const ids = relatedUserIds(userIds, exceptUserId);
      if (ids.length === 0) return;
      setNotifications((prev) => {
        let next = prev;
        for (const userId of ids) {
          const dedupeKey = draft.dedupeKey ? `${draft.dedupeKey}:${userId}` : undefined;
          if (dedupeKey && next.some((n) => n.dedupeKey === dedupeKey)) continue;
          const created: AppNotification = {
            id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId,
            type: draft.type,
            title: draft.title,
            body: draft.body,
            href: draft.href,
            orderId: draft.orderId,
            read: false,
            createdAt: new Date().toISOString(),
            dedupeKey,
          };
          next = [created, ...next];
        }
        return next;
      });
    },
    [],
  );

  const addNotification = useCallback(
    (input: AddInput) => {
      addNotifications([input.userId], input);
      return null;
    },
    [addNotifications],
  );

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    void notificationsApi.markRead(id).catch(() => undefined);
  }, []);

  const markAllRead = useCallback((userId: string) => {
    setNotifications((prev) => {
      for (const n of prev) {
        if (n.userId === userId && !n.read) {
          void notificationsApi.markRead(n.id).catch(() => undefined);
        }
      }
      return prev.map((n) => (n.userId === userId ? { ...n, read: true } : n));
    });
  }, []);

  const unreadCount = useCallback(
    (userId: string) => notifications.filter((n) => n.userId === userId && !n.read).length,
    [notifications],
  );

  const forUser = useCallback(
    (userId: string) => notifications.filter((n) => n.userId === userId),
    [notifications],
  );

  const scanOrderAlerts = useCallback(
    (
      orders: Order[],
      opts: {
        services: Array<Pick<Service, "id" | "licenseExpiryWarnMonths">>;
        vatWarnDays: number;
      },
    ): AppNotification[] => {
      const day = todayKey();
      const toCreate: AppNotification[] = [];

      const queue = (order: Order, input: Omit<AddInput, "userId">) => {
        for (const userId of orderJobOwnerIds(order)) {
          const created: AppNotification = {
            id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            userId,
            type: input.type,
            title: input.title,
            body: input.body,
            href: input.href,
            orderId: input.orderId,
            read: false,
            createdAt: new Date().toISOString(),
            dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : undefined,
          };
          toCreate.push(created);
        }
      };

      for (const order of orders) {
        if (order.stage !== "cancelled" && order.stage !== "completed" && order.deadline) {
          const d = daysUntil(order.deadline);
          if (d < 0) {
            queue(order, {
              type: "order_overdue",
              title: tt("notif.overdueTitle", { number: order.orderNumber }),
              body: tt("notif.overdueBody", { date: order.deadline, n: Math.abs(d) }),
              href: `/orders/${order.id}`,
              orderId: order.id,
              dedupeKey: `order_overdue:${order.id}:${day}`,
            });
          }
        }

        if (order.needsVat && order.vatIssueDeadline) {
          const d = daysUntil(order.vatIssueDeadline);
          if (d >= 0 && d <= opts.vatWarnDays) {
            queue(order, {
              type: "vat_deadline_approaching",
              title: tt("notif.vatTitle", { number: order.orderNumber }),
              body: tt("notif.vatBody", { date: order.vatIssueDeadline, n: d }),
              href: `/orders/${order.id}`,
              orderId: order.id,
              dedupeKey: `vat_deadline:${order.id}:${day}`,
            });
          }
        }

        const warnMonths = licenseWarnMonthsOf(
          opts.services.find((s) => s.id === order.serviceId),
        );
        const lic = getOrderLicenseExpirySummary(order, warnMonths);
        if (lic.tone === "expiring" || lic.tone === "expired") {
          queue(order, {
            type: "license_expiring",
            title:
              lic.tone === "expired"
                ? tt("notif.licenseExpiredTitle", { number: order.orderNumber })
                : tt("notif.licenseExpiringTitle", { number: order.orderNumber }),
            body: tt("notif.licenseBody", {
              name: order.customerName,
              date: lic.earliestExpiresAt ?? "—",
            }),
            href: `/orders/${order.id}`,
            orderId: order.id,
            dedupeKey: `license_expiring:${order.id}:${day}`,
          });
        }
      }

      if (toCreate.length === 0) return [];

      let fresh: AppNotification[] = [];
      setNotifications((prev) => {
        const existing = new Set(prev.map((n) => n.dedupeKey).filter(Boolean));
        fresh = toCreate.filter((n) => !n.dedupeKey || !existing.has(n.dedupeKey));
        return fresh.length ? [...fresh, ...prev] : prev;
      });
      return fresh;
    },
    [],
  );

  const value = useMemo(
    () => ({
      notifications,
      ready,
      addNotification,
      addNotifications,
      markRead,
      markAllRead,
      unreadCount,
      forUser,
      scanOrderAlerts,
      replaceNotifications,
    }),
    [
      notifications,
      ready,
      addNotification,
      addNotifications,
      markRead,
      markAllRead,
      unreadCount,
      forUser,
      scanOrderAlerts,
      replaceNotifications,
    ],
  );

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
