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
import { NOTIFICATION_PAGE_SIZE } from "@/lib/http/paging";
import { PERMISSION } from "@/lib/rbac";
import { useSession } from "@/lib/session/session-provider";
import type { AppNotification, NotificationCategory } from "@/lib/types";
import { notificationsApi } from "@/modules/notifications/api";
import { mapApiNotificationToUi } from "@/modules/notifications/map-to-ui";
import { sumCategoryCounts, type UnreadCountState } from "@/modules/notifications/model";

const POLL_MS = 60_000;

const IDLE_COUNTS: UnreadCountState = { status: "idle", total: 0, byCategory: {} };

type Ctx = {
  notifications: AppNotification[];
  ready: boolean;
  counts: UnreadCountState;
  markRead: (id: string) => void;
  markAllRead: (userId: string) => void;
  /** Mark the signed-in user's unread rows in these categories. No-op when there are none. */
  markCategoriesRead: (categories: NotificationCategory[]) => void;
  unreadCount: (userId: string) => number;
  forUser: (userId: string) => AppNotification[];
  replaceNotifications: (items: AppNotification[]) => void;
  /** GET /notifications after a domain command that the server may have written into the inbox. */
  refreshInbox: () => void;
  refreshUnreadCounts: () => void;
};

const NotificationsContext = createContext<Ctx | null>(null);

function dropCategories(state: UnreadCountState, categories: NotificationCategory[]): UnreadCountState {
  if (state.status !== "ready") return state;
  const byCategory = { ...state.byCategory };
  let dropped = 0;
  for (const category of categories) {
    dropped += byCategory[category] ?? 0;
    byCategory[category] = 0;
  }
  return { ...state, total: Math.max(0, state.total - dropped), byCategory };
}

function dropOne(state: UnreadCountState, category: NotificationCategory | undefined): UnreadCountState {
  if (state.status !== "ready") return state;
  const byCategory = { ...state.byCategory };
  if (category && (byCategory[category] ?? 0) > 0) {
    byCategory[category] = (byCategory[category] ?? 0) - 1;
  }
  return { ...state, total: Math.max(0, state.total - 1), byCategory };
}

async function reloadInbox(): Promise<AppNotification[] | null> {
  try {
    const page = await notificationsApi.list({ page: 1, pageSize: NOTIFICATION_PAGE_SIZE });
    const items = Array.isArray(page) ? page : (page.items ?? []);
    return items.map(mapApiNotificationToUi);
  } catch {
    return null;
  }
}

/** Inbox only. Rows come from GET /notifications. Do not invent local notifications. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status, user } = useSession();
  const allowed =
    status === "authenticated" && Boolean(user?.permissions?.includes(PERMISSION.notificationViewOwn));
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [ready] = useState(true);
  const [counts, setCounts] = useState<UnreadCountState>(IDLE_COUNTS);
  const sessionRef = useRef({ allowed, userId: user?.id });
  useEffect(() => {
    sessionRef.current = { allowed, userId: user?.id };
  }, [allowed, user?.id]);

  const trackedUserId = allowed ? user?.id : undefined;
  const [countsForUser, setCountsForUser] = useState(trackedUserId);
  if (countsForUser !== trackedUserId) {
    setCountsForUser(trackedUserId);
    setCounts(IDLE_COUNTS);
  }

  const publishedCounts = useMemo<UnreadCountState>(
    () => (allowed ? counts : { status: "unavailable", total: 0, byCategory: {} }),
    [allowed, counts],
  );

  const refreshUnreadCounts = useCallback(() => {
    if (!allowed) return;
    const requestUser = user?.id;
    void notificationsApi.unreadCount().then((snapshot) => {
      if (sessionRef.current.userId !== requestUser || !sessionRef.current.allowed) return;
      if (!snapshot) {
        setCounts({ status: "unavailable", total: 0, byCategory: {} });
        return;
      }
      setCounts({ status: "ready", total: snapshot.total, byCategory: snapshot.byCategory });
    });
  }, [allowed, user?.id]);

  const refreshInbox = useCallback(() => {
    void reloadInbox().then((items) => {
      if (items) setNotifications(items);
    });
    refreshUnreadCounts();
  }, [refreshUnreadCounts]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    const requestUser = user?.id;
    const load = () => {
      void notificationsApi.unreadCount().then((snapshot) => {
        if (cancelled || sessionRef.current.userId !== requestUser || !sessionRef.current.allowed) return;
        if (!snapshot) {
          setCounts({ status: "unavailable", total: 0, byCategory: {} });
          return;
        }
        setCounts({ status: "ready", total: snapshot.total, byCategory: snapshot.byCategory });
      });
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "hidden") return;
      load();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      load();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(id);
    };
  }, [allowed, user?.id]);

  const replaceNotifications = useCallback((items: AppNotification[]) => {
    setNotifications(items);
  }, []);

  const markRead = useCallback(
    (id: string) => {
      const target = notifications.find((n) => n.id === id);
      if (target && !target.read) {
        setCounts((prev) => dropOne(prev, target.category));
      }
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      void notificationsApi
        .markRead(id)
        .catch(() => undefined)
        .then(() => refreshUnreadCounts());
    },
    [notifications, refreshUnreadCounts],
  );

  const markAllRead = useCallback(
    (userId: string) => {
      const ids = notifications.filter((n) => n.userId === userId && !n.read).map((n) => n.id);
      setNotifications((prev) => prev.map((n) => (n.userId === userId ? { ...n, read: true } : n)));
      setCounts((prev) => (prev.status === "ready" ? { ...prev, total: 0, byCategory: {} } : prev));
      void (async () => {
        const marked = await notificationsApi.markAllRead();
        if (!marked) {
          let extra: string[] = [];
          try {
            const page = await notificationsApi.list(
              { page: 1, pageSize: 50 },
              { skipErrorEmit: true },
            );
            const items = Array.isArray(page) ? page : (page.items ?? []);
            extra = items.filter((row) => !row.readAt).map((row) => row.id);
          } catch {
            extra = [];
          }
          const all = [...new Set([...ids, ...extra])];
          await Promise.all(all.map((itemId) => notificationsApi.markRead(itemId).catch(() => undefined)));
        }
        const next = await reloadInbox();
        if (next) setNotifications(next);
        refreshUnreadCounts();
      })();
    },
    [notifications, refreshUnreadCounts],
  );

  const markCategoriesRead = useCallback(
    (categories: NotificationCategory[]) => {
      if (!categories.length) return;
      const current = notifications.filter(
        (n) => !n.read && n.category != null && categories.includes(n.category),
      );
      const countsNow = publishedCounts;
      const serverUnread =
        countsNow.status === "ready" ? sumCategoryCounts(countsNow.byCategory, categories) : current.length;
      if (serverUnread <= 0 && current.length === 0) return;

      setNotifications((prev) =>
        prev.map((n) => (n.category && categories.includes(n.category) ? { ...n, read: true } : n)),
      );
      setCounts((prev) => dropCategories(prev, categories));

      void (async () => {
        const missed: NotificationCategory[] = [];
        for (const category of categories) {
          const marked = await notificationsApi.markAllRead(category);
          if (!marked) missed.push(category);
        }
        if (missed.length) {
          const ids = new Set(
            current.filter((n) => n.category && missed.includes(n.category)).map((n) => n.id),
          );
          if (serverUnread > current.length) {
            for (const category of missed) {
              const rows = await notificationsApi.listByCategory(category);
              if (!rows) continue;
              for (const row of rows) {
                const mapped = mapApiNotificationToUi(row);
                if (!mapped.read && mapped.category === category) ids.add(mapped.id);
              }
            }
          }
          await Promise.all([...ids].map((id) => notificationsApi.markRead(id).catch(() => undefined)));
        }
        const next = await reloadInbox();
        if (next) setNotifications(next);
        refreshUnreadCounts();
      })();
    },
    [notifications, publishedCounts, refreshUnreadCounts],
  );

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
      counts: publishedCounts,
      markRead,
      markAllRead,
      markCategoriesRead,
      unreadCount,
      forUser,
      replaceNotifications,
      refreshInbox,
      refreshUnreadCounts,
    }),
    [
      notifications,
      ready,
      publishedCounts,
      markRead,
      markAllRead,
      markCategoriesRead,
      unreadCount,
      forUser,
      replaceNotifications,
      refreshInbox,
      refreshUnreadCounts,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
