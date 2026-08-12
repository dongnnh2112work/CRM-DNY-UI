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
import { loadJson, saveJson } from "@/lib/demo-storage";
import { daysUntil, getOrderLicenseExpirySummary } from "@/lib/order-helpers";
import type { AppNotification, AppNotificationType, Order } from "@/lib/types";

const KEY = "dny-crm-notifications";

type AddInput = {
  userId: string;
  type: AppNotificationType;
  title: string;
  body: string;
  href?: string;
  orderId?: string;
  dedupeKey?: string;
};

type Ctx = {
  notifications: AppNotification[];
  ready: boolean;
  addNotification: (input: AddInput) => AppNotification | null;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  unreadCount: (userId: string) => number;
  forUser: (userId: string) => AppNotification[];
  scanOrderAlerts: (
    orders: Order[],
    opts: { licenseWarnMonths: number; vatWarnDays: number; mirrorEmail?: (n: AppNotification) => void },
  ) => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = loadJson<AppNotification[]>(KEY);
    if (stored && Array.isArray(stored)) setNotifications(stored);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveJson(KEY, notifications);
  }, [notifications, ready]);

  const addNotification = useCallback((input: AddInput) => {
    let created: AppNotification | null = null;
    setNotifications((prev) => {
      if (input.dedupeKey && prev.some((n) => n.dedupeKey === input.dedupeKey)) {
        return prev;
      }
      created = {
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        orderId: input.orderId,
        read: false,
        createdAt: new Date().toISOString(),
        dedupeKey: input.dedupeKey,
      };
      return [created, ...prev];
    });
    return created;
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const markAllRead = useCallback((userId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    );
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
        licenseWarnMonths: number;
        vatWarnDays: number;
        mirrorEmail?: (n: AppNotification) => void;
      },
    ) => {
      const day = todayKey();
      const toCreate: AppNotification[] = [];

      const queue = (input: AddInput) => {
        const created: AppNotification = {
          id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          userId: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          href: input.href,
          orderId: input.orderId,
          read: false,
          createdAt: new Date().toISOString(),
          dedupeKey: input.dedupeKey,
        };
        toCreate.push(created);
      };

      for (const order of orders) {
        if (order.stage !== "cancelled" && order.stage !== "completed" && order.deadline) {
          const d = daysUntil(order.deadline);
          if (d < 0) {
            queue({
              userId: order.assignedUserId,
              type: "order_overdue",
              title: `Đơn ${order.orderNumber} quá hạn xử lý`,
              body: `Deadline ${order.deadline} đã qua ${Math.abs(d)} ngày.`,
              href: `/orders/${order.id}`,
              orderId: order.id,
              dedupeKey: `order_overdue:${order.id}:${day}`,
            });
          }
        }

        if (order.needsVat && order.vatIssueDeadline) {
          const d = daysUntil(order.vatIssueDeadline);
          if (d >= 0 && d <= opts.vatWarnDays) {
            queue({
              userId: order.assignedUserId,
              type: "vat_deadline_approaching",
              title: `Sắp hết hạn xuất VAT — ${order.orderNumber}`,
              body: `Hạn xuất VAT: ${order.vatIssueDeadline} (còn ${d} ngày).`,
              href: `/orders/${order.id}`,
              orderId: order.id,
              dedupeKey: `vat_deadline:${order.id}:${day}`,
            });
          }
        }

        const lic = getOrderLicenseExpirySummary(order, opts.licenseWarnMonths);
        if (lic.tone === "expiring" || lic.tone === "expired") {
          queue({
            userId: order.assignedUserId,
            type: "license_expiring",
            title:
              lic.tone === "expired"
                ? `Giấy phép hết hạn — ${order.orderNumber}`
                : `Giấy phép sắp hết hạn — ${order.orderNumber}`,
            body: `Khách ${order.customerName}: hạn GP ${lic.earliestExpiresAt ?? "—"}. Nhắc gia hạn.`,
            href: `/orders/${order.id}`,
            orderId: order.id,
            dedupeKey: `license_expiring:${order.id}:${day}`,
          });
        }
      }

      if (toCreate.length === 0) return;

      setNotifications((prev) => {
        const existing = new Set(prev.map((n) => n.dedupeKey).filter(Boolean));
        const fresh = toCreate.filter((n) => !n.dedupeKey || !existing.has(n.dedupeKey));
        for (const n of fresh) opts.mirrorEmail?.(n);
        return fresh.length ? [...fresh, ...prev] : prev;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      notifications,
      ready,
      addNotification,
      markRead,
      markAllRead,
      unreadCount,
      forUser,
      scanOrderAlerts,
    }),
    [
      notifications,
      ready,
      addNotification,
      markRead,
      markAllRead,
      unreadCount,
      forUser,
      scanOrderAlerts,
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
