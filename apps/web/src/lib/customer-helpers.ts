import { MOCK_USERS } from "@/lib/mock-users";
import type { FieldDefinition, Order, Service } from "@/lib/types";

export type CustomerUsedService = {
  serviceId: string;
  serviceName: string;
  category?: string;
  orderCount: number;
  lastOrderAt?: string;
  fromOrders: boolean;
  fromRecord: boolean;
};

export const CUSTOMER_OWNER_OPTIONS = MOCK_USERS.filter(
  (u) => u.role === "staff" || u.role === "admin",
).map((u) => ({ value: u.name, label: u.name }));

export function getCustomerOrders(customerId: string, orders: Order[]) {
  return orders.filter((o) => o.customerId === customerId);
}

export function getCustomerUsedServices(
  customerId: string,
  recordedIds: string[] | undefined,
  orders: Order[],
  services: Service[],
): CustomerUsedService[] {
  const customerOrders = getCustomerOrders(customerId, orders);
  const byService = new Map<string, CustomerUsedService>();

  for (const order of customerOrders) {
    const existing = byService.get(order.serviceId);
    const svc = services.find((s) => s.id === order.serviceId);
    const lastOrderAt =
      existing?.lastOrderAt && existing.lastOrderAt > order.createdAt
        ? existing.lastOrderAt
        : order.createdAt;
    byService.set(order.serviceId, {
      serviceId: order.serviceId,
      serviceName: svc?.name ?? order.serviceName,
      category: svc?.category,
      orderCount: (existing?.orderCount ?? 0) + 1,
      lastOrderAt,
      fromOrders: true,
      fromRecord: existing?.fromRecord ?? false,
    });
  }

  for (const id of recordedIds ?? []) {
    const existing = byService.get(id);
    if (existing) {
      existing.fromRecord = true;
      continue;
    }
    const svc = services.find((s) => s.id === id);
    byService.set(id, {
      serviceId: id,
      serviceName: svc?.name ?? id,
      category: svc?.category,
      orderCount: 0,
      fromOrders: false,
      fromRecord: true,
    });
  }

  return [...byService.values()].sort((a, b) => a.serviceName.localeCompare(b.serviceName, "vi"));
}

export function usedServiceNames(used: CustomerUsedService[]) {
  return used.map((s) => s.serviceName);
}

/** Fields stored on Customer root — không đưa vào customFields / không xóa được. */
export const CUSTOMER_CORE_FIELD_KEYS = new Set([
  "name",
  "phone",
  "email",
  "company",
  "taxCode",
  "address",
  "owner",
  "status",
  "usedServiceIds",
  "createdAt",
]);

/** Extra fields on create/edit — chỉ sau khi cột visible đã được Lưu. */
export function getCustomerFormExtraFields(fieldDefs: FieldDefinition[]): FieldDefinition[] {
  return fieldDefs
    .filter((d) => d.visible && !CUSTOMER_CORE_FIELD_KEYS.has(d.key))
    .sort((a, b) => a.order - b.order);
}

export function collectCustomFields(
  values: Record<string, unknown>,
  extraFields: FieldDefinition[],
  previous?: Record<string, unknown>,
): Record<string, unknown> {
  const customFields: Record<string, unknown> = { ...(previous ?? {}) };
  for (const def of extraFields) {
    const v = values[def.key];
    if (v === undefined || v === null || v === "") {
      delete customFields[def.key];
    } else {
      customFields[def.key] = def.type === "number" ? Number(v) : v;
    }
  }
  return customFields;
}
