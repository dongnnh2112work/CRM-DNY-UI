import { dateSearchHaystack } from "@/lib/format-date";
import { formatVndDisplay } from "@/lib/format-vnd";
import { t } from "@/lib/i18n";

/**
 * Fold case and Vietnamese diacritics so “dong” matches “Hải Đông” and “Don” matches “Đôn”.
 * `đ` does not decompose under NFD, so it is replaced on its own.
 */
export function foldSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

/** Match query against any displayed table cell values (text, numbers, money, lists). */
export function matchesTableQuery(query: string, parts: unknown[]): boolean {
  const q = foldSearchText(query.trim());
  if (!q) return true;

  return parts.some((part) => valueMatches(part, q));
}

function valueMatches(value: unknown, q: string): boolean {
  if (value == null || value === "") return false;

  if (typeof value === "number") {
    return (
      foldSearchText(String(value)).includes(q) ||
      foldSearchText(value.toLocaleString("vi-VN")).includes(q) ||
      foldSearchText(formatVndDisplay(value)).includes(q)
    );
  }

  if (typeof value === "boolean") {
    const labels = (["vi", "en", "zh"] as const).map((locale) =>
      t(locale, value ? "common.yesSearch" : "common.noSearch"),
    );
    return labels.some((label) => foldSearchText(label).includes(q)) || foldSearchText(String(value)).includes(q);
  }

  if (Array.isArray(value)) {
    return value.some((item) => valueMatches(item, q));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => valueMatches(item, q));
  }

  return dateSearchHaystack(String(value)).some((part) => foldSearchText(part).includes(q));
}
