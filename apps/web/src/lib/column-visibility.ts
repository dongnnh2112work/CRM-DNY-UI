import { loadJson, saveJson } from "@/lib/demo-storage";

export type ColumnVisibility = Record<string, boolean>;

export function columnPrefsKey(id: string) {
  return `dny-crm-columns:${id}`;
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

export function loadColumnVisibility(id: string, keys: string[]): ColumnVisibility {
  return mergeColumnVisibility(loadJson<ColumnVisibility>(columnPrefsKey(id)), keys);
}

export function saveColumnVisibility(id: string, value: ColumnVisibility) {
  saveJson(columnPrefsKey(id), value);
}
