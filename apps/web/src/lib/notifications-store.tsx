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
import { NOTIFICATION_PAGE_SIZE } from "@/lib/http/paging";
import type { AppNotification } from "@/lib/types";
import { notificationsApi } from "@/modules/notifications/api";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";

type Ctx = {
  notifications: AppNotification[];
  ready: boolean;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  unreadCount: (userId: string) => number;
  forUser: (userId: string) => AppNotification[];
  replaceNotifications: (items: AppNotification[]) => void;
  /** GET /notifications after a domain command that the server may have written into the inbox. */
  refreshInbox: () => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

/** Inbox only. Rows come from GET /notifications. Do not invent local notifications. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
  }, []);

  const replaceNotifications = useCallback((items: AppNotification[]) => {
    setNotifications(items);
  }, []);

  const refreshInbox = useCallback(() => {
    void notificationsApi
      .list({ page: 1, pageSize: NOTIFICATION_PAGE_SIZE })
      .then((page) => {
        const items = Array.isArray(page) ? page : (page.items ?? []);
        setNotifications(items.map(mapApiNotificationToUi));
      })
      .catch(() => undefined);
  }, []);

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

  const value = useMemo(
    () => ({
      notifications,
      ready,
      markRead,
      markAllRead,
      unreadCount,
      forUser,
      replaceNotifications,
      refreshInbox,
    }),
    [notifications, ready, markRead, markAllRead, unreadCount, forUser, replaceNotifications, refreshInbox],
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
