import { loadJson, saveJson } from "@/lib/demo-storage";

export type ColumnVisibility = Record<string, boolean>;

/** Per-user key so two people on one browser do not share column visibility. */
export function columnPrefsKey(id: string, userId?: string | null) {
  const who = userId?.trim() || "anonymous";
  return `dny-crm-columns:${who}:${id}`;
}

export function mergeColumnVisibility(
  stored: ColumnVisibility | null | undefined,
  keys: string[],
): ColumnVisibility {
  const next: ColumnVisibility = {};
  for (const key of keys) {
    next[key] = stored && Object.prototype.hasOwnProperty.call(stored, key) ? stored[key] : true;
  }
  return next;
}

export function loadColumnVisibility(id: string, keys: string[], userId?: string | null): ColumnVisibility {
  return mergeColumnVisibility(loadJson<ColumnVisibility>(columnPrefsKey(id, userId)), keys);
}

export function saveColumnVisibility(id: string, value: ColumnVisibility, userId?: string | null) {
  saveJson(columnPrefsKey(id, userId), value);
}
