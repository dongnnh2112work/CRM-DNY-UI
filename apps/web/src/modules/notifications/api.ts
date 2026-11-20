import { apiRequest, ApiError } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";
import { parseUnreadCount, type UnreadCountSnapshot } from "@/modules/notifications/model";

export type ApiNotification = {
  id: string;
  recipientUserId: string;
  type: string;
  category?: string | null;
  title: string;
  body: string | null;
  readAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  href: string | null;
  dedupeKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type ListQuery = {
  page?: number;
  pageSize?: number;
  category?: string;
};

/** Remember a rejected `?category=` so section navigation does not keep retrying a missing filter. */
let categoryQuerySupported: boolean | null = null;

function isMissingRoute(err: unknown): boolean {
  return err instanceof ApiError && (err.statusCode === 400 || err.statusCode === 404 || err.statusCode === 405 || err.statusCode === 422);
}

export const notificationsApi = {
  list(query: ListQuery = {}, init?: { skipErrorEmit?: boolean }) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 50));
    if (query.category) params.set("category", query.category);
    return apiRequest<PageResult<ApiNotification>>(`/notifications?${params.toString()}`, {
      skipErrorEmit: init?.skipErrorEmit,
    });
  },

  /**
   * Rows for one category. Null when the server does not accept `category`
   * (or the call failed). Callers must still filter by category.
   */
  async listByCategory(category: string): Promise<ApiNotification[] | null> {
    if (categoryQuerySupported === false) return null;
    try {
      const page = await notificationsApi.list(
        { page: 1, pageSize: 50, category },
        { skipErrorEmit: true },
      );
      categoryQuerySupported = true;
      return Array.isArray(page) ? page : (page.items ?? []);
    } catch (err) {
      if (isMissingRoute(err)) categoryQuerySupported = false;
      return null;
    }
  },

  /** Null when the count route is not deployed or the body is unusable. */
  async unreadCount(): Promise<UnreadCountSnapshot | null> {
    try {
      const raw = await apiRequest<unknown>("/notifications/unread-count", { skipErrorEmit: true });
      return parseUnreadCount(raw);
    } catch {
      return null;
    }
  },

  markRead(id: string) {
    return apiRequest<ApiNotification>(`/notifications/${id}/read`, {
      method: "POST",
      skipErrorEmit: true,
    });
  },

  /**
   * `POST /notifications/read-all?category=`.
   * Returns `{ updated }` when the route accepts the call.
   * Null when the route is missing or the call fails (old servers still use per-id read).
   */
  async markAllRead(category?: string): Promise<{ updated: number } | null> {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    const query = params.toString();
    try {
      const raw = await apiRequest<unknown>(
        `/notifications/read-all${query ? `?${query}` : ""}`,
        { method: "POST", skipErrorEmit: true },
      );
      const updated =
        raw && typeof raw === "object" && "updated" in raw
          ? (raw as { updated?: unknown }).updated
          : 0;
      const count =
        typeof updated === "number" && Number.isFinite(updated) ? Math.max(0, Math.floor(updated)) : 0;
      return { updated: count };
    } catch {
      return null;
    }
  },
};
