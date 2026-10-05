import { PERMISSION } from "@/lib/rbac";
import { canLoadScope } from "@/lib/route-data-scopes";
import { collaboratorsApi } from "@/modules/collaborators/api";
import { contractsApi } from "@/modules/contracts/api";
import { customersApi } from "@/modules/customers/api";
import { identityAdminApi } from "@/modules/identity-admin/api";
import { unwrapIdentityEntity } from "@/modules/identity-admin/map-to-ui";
import type { IdentityUser } from "@/modules/identity-admin/api";
import { ordersApi } from "@/modules/orders/api";
import { servicesApi } from "@/modules/services/api";

type NameCache = Map<string, string>;

const customerNames: NameCache = new Map();
const serviceNames: NameCache = new Map();
const userNames: NameCache = new Map();
const contractNumbers: NameCache = new Map();
const ctvNames: NameCache = new Map();
const orderNumbers: NameCache = new Map();

const inflight = new Map<string, Promise<void>>();

export function clearEntityLookupCache() {
  customerNames.clear();
  serviceNames.clear();
  userNames.clear();
  contractNumbers.clear();
  ctvNames.clear();
  orderNumbers.clear();
  inflight.clear();
}

export function lookupCustomerName(id?: string | null) {
  if (!id) return undefined;
  const v = customerNames.get(id);
  return v || undefined;
}

export function lookupServiceName(id?: string | null) {
  if (!id) return undefined;
  const v = serviceNames.get(id);
  return v || undefined;
}

export function lookupUserName(id?: string | null) {
  if (!id) return undefined;
  const v = userNames.get(id);
  return v || undefined;
}

export function lookupContractNumber(id?: string | null) {
  if (!id) return undefined;
  const v = contractNumbers.get(id);
  return v || undefined;
}

export function lookupCtvName(id?: string | null) {
  if (!id) return undefined;
  const v = ctvNames.get(id);
  return v || undefined;
}

export function lookupOrderNumber(id?: string | null) {
  if (!id) return undefined;
  const v = orderNumbers.get(id);
  return v || undefined;
}

export function rememberCustomerName(id: string, name: string) {
  if (id && name) customerNames.set(id, name);
}

export function rememberServiceName(id: string, name: string) {
  if (id && name) serviceNames.set(id, name);
}

export function rememberUserName(id: string, name: string) {
  if (id && name) userNames.set(id, name);
}

export function rememberContractNumber(id: string, number: string) {
  if (id && number) contractNumbers.set(id, number);
}

export function rememberCtvName(id: string, name: string) {
  if (id && name) ctvNames.set(id, name);
}

export function rememberOrderNumber(id: string, number: string) {
  if (id && number) orderNumbers.set(id, number);
}

/** Remember a failed lookup so we do not retry (403 / 404 / empty). */
function markMiss(cache: NameCache, id: string) {
  if (id && !cache.has(id)) cache.set(id, "");
}

async function mapPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      if (next === undefined) return;
      await fn(next);
    }
  });
  await Promise.all(workers);
}

export type LookupRequest = {
  customerIds?: string[];
  serviceIds?: string[];
  userIds?: string[];
  contractIds?: string[];
  ctvIds?: string[];
  orderIds?: string[];
};

/**
 * Resolve display names for the visible page via GET /:id.
 * Permission-gated; missing permission → leave unresolved (UI shows "—").
 */
export async function resolveEntityLookups(
  req: LookupRequest,
  permissions: string[] | undefined | null,
): Promise<void> {
  const tasks: Array<() => Promise<void>> = [];

  const enqueue = (key: string, run: () => Promise<void>) => {
    if (inflight.has(key)) {
      tasks.push(() => inflight.get(key)!);
      return;
    }
    const p = run().finally(() => inflight.delete(key));
    inflight.set(key, p);
    tasks.push(() => p);
  };

  if (canLoadScope("customers", permissions)) {
    for (const id of new Set(req.customerIds ?? [])) {
      if (!id || customerNames.has(id)) continue;
      enqueue(`customer:${id}`, async () => {
        try {
          const raw = await customersApi.get(id);
          const row = (raw as { data?: { name?: string; displayName?: string } })?.data ?? raw;
          const name =
            (row as { name?: string }).name ||
            (row as { displayName?: string }).displayName ||
            "";
          if (name) customerNames.set(id, name);
          else markMiss(customerNames, id);
        } catch {
          markMiss(customerNames, id);
        }
      });
    }
  }

  if (canLoadScope("services", permissions)) {
    for (const id of new Set(req.serviceIds ?? [])) {
      if (!id || serviceNames.has(id)) continue;
      enqueue(`service:${id}`, async () => {
        try {
          const raw = await servicesApi.get(id);
          const row = (raw as { data?: { name?: string } })?.data ?? raw;
          const name = (row as { name?: string }).name || "";
          if (name) serviceNames.set(id, name);
          else markMiss(serviceNames, id);
        } catch {
          markMiss(serviceNames, id);
        }
      });
    }
  }

  // Order/list UIs need assignee labels; try GET /users/:id when user.manage or order.view.
  // 403 → markMiss (UI keeps fallback, no retry storm).
  if (
    permissions?.includes(PERMISSION.userManage) ||
    permissions?.includes(PERMISSION.orderView)
  ) {
    for (const id of new Set(req.userIds ?? [])) {
      if (!id || userNames.has(id)) continue;
      enqueue(`user:${id}`, async () => {
        try {
          const raw = await identityAdminApi.getUser(id);
          const row = unwrapIdentityEntity<IdentityUser>(raw) ?? (raw as IdentityUser);
          const name = row.displayName || row.email || "";
          if (name) userNames.set(id, name);
          else markMiss(userNames, id);
        } catch {
          markMiss(userNames, id);
        }
      });
    }
  }

  if (canLoadScope("contracts", permissions)) {
    for (const id of new Set(req.contractIds ?? [])) {
      if (!id || contractNumbers.has(id)) continue;
      enqueue(`contract:${id}`, async () => {
        try {
          const raw = await contractsApi.get(id);
          const row = (raw as { data?: { contractNumber?: string } })?.data ?? raw;
          const number = (row as { contractNumber?: string }).contractNumber || "";
          if (number) contractNumbers.set(id, number);
          else markMiss(contractNumbers, id);
        } catch {
          markMiss(contractNumbers, id);
        }
      });
    }
  }

  if (canLoadScope("orders", permissions)) {
    for (const id of new Set(req.ctvIds ?? [])) {
      if (!id || ctvNames.has(id)) continue;
      enqueue(`ctv:${id}`, async () => {
        try {
          const raw = await collaboratorsApi.get(id);
          const row = (raw as { data?: { displayName?: string } })?.data ?? raw;
          const name = (row as { displayName?: string }).displayName || "";
          if (name) ctvNames.set(id, name);
          else markMiss(ctvNames, id);
        } catch {
          markMiss(ctvNames, id);
        }
      });
    }

    for (const id of new Set(req.orderIds ?? [])) {
      if (!id || orderNumbers.has(id)) continue;
      enqueue(`order:${id}`, async () => {
        try {
          const raw = await ordersApi.get(id);
          const row = (raw as { data?: { orderNumber?: string } })?.data ?? raw;
          const number = (row as { orderNumber?: string }).orderNumber || "";
          if (number) orderNumbers.set(id, number);
          else markMiss(orderNumbers, id);
        } catch {
          markMiss(orderNumbers, id);
        }
      });
    }
  }

  await mapPool(tasks, 6, (fn) => fn());
}
