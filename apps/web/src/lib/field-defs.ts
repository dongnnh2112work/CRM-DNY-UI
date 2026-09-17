import type { FieldDefinition } from "@/lib/types";

export function mergeSeedFieldDefs(stored: FieldDefinition[], seed: FieldDefinition[]): FieldDefinition[] {
  const have = new Set(stored.map((d) => d.key));
  const missing = seed.filter((d) => !have.has(d.key));
  if (missing.length === 0) return stored;
  return [...stored, ...missing].sort((a, b) => a.order - b.order);
}

/** Keep `fieldKey` visible immediately after `anchorKey` (e.g. createdAt next to name). */
export function pinFieldAfter(
  defs: FieldDefinition[],
  fieldKey: string,
  anchorKey: string,
  seed: FieldDefinition[],
): FieldDefinition[] {
  const seedField = seed.find((d) => d.key === fieldKey);
  const rest = defs.filter((d) => d.key !== fieldKey).sort((a, b) => a.order - b.order);
  const field = defs.find((d) => d.key === fieldKey) ?? seedField;
  if (!field) return defs;
  const insertAt = Math.max(0, rest.findIndex((d) => d.key === anchorKey) + 1);
  const next = [...rest];
  next.splice(insertAt, 0, { ...field, visible: true });
  return next.map((d, i) => ({ ...d, order: i + 1 }));
}
