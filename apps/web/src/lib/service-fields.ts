import type { FieldDefinition } from "@/lib/types";

/** Keys stored on Service root (not customFields) */
export const SERVICE_CORE_KEYS = new Set([
  "name",
  "code",
  "category",
  "unitPrice",
  "processingDays",
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
  return {
    core: {
      name: String(values.name ?? ""),
      code: String(values.code ?? ""),
      category: String(values.category ?? ""),
      unitPrice: Number(values.unitPrice),
      processingDays: Number(values.processingDays),
    },
    customFields,
  };
}
