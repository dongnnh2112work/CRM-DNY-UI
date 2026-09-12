import { apiRequest } from "@/lib/http/client";

export type ApiAppConfig = {
  key: string;
  valueJson: unknown;
  createdAt: string;
  updatedAt: string;
};

export class ConfigNotPersistedError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(`Config ${key} was not persisted`);
    this.name = "ConfigNotPersistedError";
    this.key = key;
  }
}

function unwrapConfigList(raw: unknown): ApiAppConfig[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as ApiAppConfig[];
  if (typeof raw === "object") {
    const obj = raw as { items?: unknown; data?: unknown };
    if (Array.isArray(obj.items)) return obj.items as ApiAppConfig[];
    if (Array.isArray(obj.data)) return obj.data as ApiAppConfig[];
    if (obj.data && typeof obj.data === "object" && Array.isArray((obj.data as { items?: unknown }).items)) {
      return (obj.data as { items: ApiAppConfig[] }).items;
    }
  }
  return [];
}

function unwrapConfigRow(raw: unknown): ApiAppConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  if ("valueJson" in raw && "key" in raw) return raw as ApiAppConfig;
  const obj = raw as { data?: unknown };
  if (obj.data && typeof obj.data === "object" && "valueJson" in obj.data) {
    return obj.data as ApiAppConfig;
  }
  return unwrapConfigList(raw)[0];
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null || typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => deepEqual(left[key], right[key]));
}

export function configValueContains(remote: unknown, sent: unknown): boolean {
  const parsed = parseConfigValue(remote);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return false;
  if (!sent || typeof sent !== "object" || Array.isArray(sent)) return deepEqual(parsed, sent);
  const remoteRec = parsed as Record<string, unknown>;
  return Object.entries(sent as Record<string, unknown>).every(([key, value]) =>
    deepEqual(remoteRec[key], value),
  );
}

export const configApi = {
  list(key?: string) {
    const q = key ? `?key=${encodeURIComponent(key)}` : "";
    return apiRequest<{ items: ApiAppConfig[] }>(`/config${q}`).then((raw) => ({
      items: unwrapConfigList(raw),
    }));
  },

  get(key: string, opts?: { silent?: boolean }) {
    return apiRequest<ApiAppConfig | { items: ApiAppConfig[] }>(
      `/config/${encodeURIComponent(key)}`,
      { skipErrorEmit: opts?.silent },
    ).then((raw) => unwrapConfigRow(raw));
  },

  patch(key: string, valueJson: unknown) {
    return apiRequest<unknown>(`/config/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body: JSON.stringify({ valueJson }),
    }).then((raw) => unwrapConfigRow(raw));
  },
};

/** PATCH then GET — throw if BE 200 nhưng không giữ valueJson. */
export async function persistAndVerifyConfig(key: string, valueJson: unknown) {
  const patched = await configApi.patch(key, valueJson);
  if (configValueContains(patched?.valueJson, valueJson)) return;
  try {
    const raw = await apiRequest<unknown>(`/config/${encodeURIComponent(key)}`, {
      skipErrorEmit: true,
    });
    const row = unwrapConfigRow(raw);
    if (configValueContains(row?.valueJson, valueJson)) return;
  } catch {
    // 404 / empty
  }
  throw new ConfigNotPersistedError(key);
}

export const REMINDER_CONFIG_KEY = "crm.reminders";
export const ORDER_STAGES_CONFIG_KEY = "crm.orderStages";
export const CUSTOMER_STATUS_CATALOG_KEY = "crm.customerStatusCatalog";
export const PAGE_PERMISSIONS_CONFIG_KEY = "crm.pagePermissions";

/** BE sometimes stores JSON as a string; hydrate must parse before merge. */
export function parseConfigValue(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

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
