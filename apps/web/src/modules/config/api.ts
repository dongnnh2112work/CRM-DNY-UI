import { apiRequest } from "@/lib/http/client";

export type ApiAppConfig = {
  key: string;
  valueJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export const configApi = {
  list(key?: string) {
    const q = key ? `?key=${encodeURIComponent(key)}` : "";
    return apiRequest<{ items: ApiAppConfig[] }>(`/config${q}`);
  },

  patch(key: string, valueJson: unknown) {
    return apiRequest<ApiAppConfig>(`/config/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ valueJson }),
    });
  },
};

export const REMINDER_CONFIG_KEY = "crm.reminders";
