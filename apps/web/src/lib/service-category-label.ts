import type { MessageKey } from "@/lib/i18n";

/** English defaults shipped in the UI. Live custom labels are left unchanged. */
const DEFAULT_CATEGORY_KEYS: Record<string, MessageKey> = {
  "Work Permit": "service.category.workPermit",
  Visa: "service.category.visa",
  License: "service.category.license",
  Legal: "service.category.legal",
  Other: "service.category.other",
};

export function defaultCategoryMessageKey(label: string | null | undefined): MessageKey | null {
  const text = String(label ?? "").trim();
  return DEFAULT_CATEGORY_KEYS[text] ?? null;
}

export function displayCategoryLabel(
  label: string | null | undefined,
  translate: (key: MessageKey) => string,
): string {
  const text = String(label ?? "").trim();
  if (!text) return "";
  const key = defaultCategoryMessageKey(text);
  return key ? translate(key) : text;
}
