import { formatVndDisplay } from "@/lib/format-vnd";

/** Match query against any displayed table cell values (text, numbers, money, lists). */
export function matchesTableQuery(query: string, parts: unknown[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return parts.some((part) => valueMatches(part, q));
}

function valueMatches(value: unknown, q: string): boolean {
  if (value == null || value === "") return false;

  if (typeof value === "number") {
    return (
      String(value).toLowerCase().includes(q) ||
      value.toLocaleString("vi-VN").toLowerCase().includes(q) ||
      formatVndDisplay(value).toLowerCase().includes(q)
    );
  }

  if (typeof value === "boolean") {
    return (value ? "có" : "không").includes(q) || String(value).includes(q);
  }

  if (Array.isArray(value)) {
    return value.some((item) => valueMatches(item, q));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => valueMatches(item, q));
  }

  return String(value).toLowerCase().includes(q);
}
