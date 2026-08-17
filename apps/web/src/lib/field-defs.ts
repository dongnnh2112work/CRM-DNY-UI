import type { FieldDefinition } from "@/lib/types";

export function mergeSeedFieldDefs(stored: FieldDefinition[], seed: FieldDefinition[]): FieldDefinition[] {
  const have = new Set(stored.map((d) => d.key));
  const missing = seed.filter((d) => !have.has(d.key));
  if (missing.length === 0) return stored;
  return [...stored, ...missing].sort((a, b) => a.order - b.order);
}
