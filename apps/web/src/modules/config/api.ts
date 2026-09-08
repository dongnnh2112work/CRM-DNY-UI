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
export const ORDER_STAGES_CONFIG_KEY = "crm.orderStages";
export const CUSTOMER_STATUS_CATALOG_KEY = "crm.customerStatusCatalog";
export const PAGE_PERMISSIONS_CONFIG_KEY = "crm.pagePermissions";

const patchTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function patchConfigDebounced(key: string, valueJson: unknown, delayMs = 400) {
  const prev = patchTimers.get(key);
  if (prev) clearTimeout(prev);
  patchTimers.set(
    key,
    setTimeout(() => {
      void configApi.patch(key, valueJson).catch(() => undefined);
    }, delayMs),
  );
}
