import type { StatusTone } from "@/lib/status-config";

/** Soft Notion-like palette — swatches only */
export const STAGE_COLOR_PALETTE = [
  "#787774",
  "#9b6b43",
  "#d9730d",
  "#cb912f",
  "#448361",
  "#337ea9",
  "#9065b0",
  "#c14c8a",
  "#d44c47",
  "#5d6b7a",
  "#2a9d99",
  "#5b67a5",
  "#a8557a",
  "#6b7280",
  "#b45309",
  "#15803d",
] as const;

export const TONE_TO_HEX: Record<StatusTone, string> = {
  processing: "#337ea9",
  success: "#448361",
  warning: "#d9730d",
  error: "#d44c47",
  default: "#787774",
};

export function nextFreeStageColor(usedColors: string[]): string | null {
  const used = new Set(usedColors.map((c) => c.toLowerCase()));
  return STAGE_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase())) ?? null;
}

export function normalizeStoredColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.startsWith("#")) return raw;
  if (raw in TONE_TO_HEX) return TONE_TO_HEX[raw as StatusTone];
  return fallback;
}

export function slugifyKey(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 32);
  return base || `status_${Date.now()}`;
}

export function uniqueKey(desired: string, existing: Set<string>): string {
  let key = desired;
  let n = 2;
  while (existing.has(key)) {
    key = `${desired}_${n}`;
    n += 1;
  }
  return key;
}
