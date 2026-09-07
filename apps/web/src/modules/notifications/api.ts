import { apiRequest } from "@/lib/http/client";
import type { PageResult } from "@/lib/http/paging";

export type ApiNotification = {
  id: string;
  recipientUserId: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const notificationsApi = {
  list(query: { page?: number; pageSize?: number } = {}) {
    const params = new URLSearchParams();
    params.set("page", String(query.page ?? 1));
    params.set("pageSize", String(query.pageSize ?? 50));
    return apiRequest<PageResult<ApiNotification>>(`/notifications?${params.toString()}`);
  },

  markRead(id: string) {
    return apiRequest<ApiNotification>(`/notifications/${id}/read`, { method: "POST" });
  },
};
