import { getStatusMeta } from "@/lib/status-config";
import { matchesTableQuery } from "@/lib/table-search";
import { licenseWarnMonthsOf } from "@/lib/order-helpers";
import type { FieldDefinition, Service, ServiceStatus } from "@/lib/types";

/** Keys stored on Service root (not customFields) */
export const SERVICE_CORE_KEYS = new Set([
  "name",
  "code",
  "category",
  "unitPrice",
  "processingDays",
  "licenseExpiryWarnMonths",
  "status",
]);

/** Cột hệ thống — không cho xóa trong Quản lý cột */
export const SERVICE_LOCKED_FIELD_KEYS = [...SERVICE_CORE_KEYS];

/** Extra fields shown on create/edit when cột đang bật (visible) */
export function getServiceFormExtraFields(fieldDefs: FieldDefinition[]): FieldDefinition[] {
  return fieldDefs
    .filter((d) => d.visible && !SERVICE_CORE_KEYS.has(d.key))
    .sort((a, b) => a.order - b.order);
}

/** Search across all values shown (or showable) in the services table. */
export function serviceMatchesQuery(service: Service, query: string): boolean {
  return matchesTableQuery(query, [
    service.name,
    service.code,
    service.category,
    service.status,
    getStatusMeta("service", service.status).label,
    service.unitPrice,
    service.processingDays,
    service.licenseExpiryWarnMonths,
    service.customFields,
  ]);
}

export function splitServiceFormValues(
  values: Record<string, unknown>,
  extraFields: FieldDefinition[],
): {
  core: {
    name: string;
    code: string;
    category: string;
    unitPrice: number;
    processingDays: number;
    licenseExpiryWarnMonths: number;
    status?: ServiceStatus;
  };
  customFields: Record<string, unknown>;
} {
  const customFields: Record<string, unknown> = {};
  for (const def of extraFields) {
    const v = values[def.key];
    if (v !== undefined && v !== null && v !== "") {
      customFields[def.key] = def.type === "number" ? Number(v) : v;
    }
  }
  const status = values.status === "active" || values.status === "inactive" ? values.status : undefined;
  return {
    core: {
      name: String(values.name ?? ""),
      code: String(values.code ?? ""),
      category: String(values.category ?? ""),
      unitPrice: Number(values.unitPrice),
      processingDays: Number(values.processingDays),
      licenseExpiryWarnMonths: licenseWarnMonthsOf({
        licenseExpiryWarnMonths: Number(values.licenseExpiryWarnMonths),
      }),
      ...(status ? { status } : {}),
    },
    customFields,
  };
}
