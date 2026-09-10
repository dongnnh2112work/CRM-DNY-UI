import type { Dayjs } from "dayjs";

export type DateRangeValue = [Dayjs | null, Dayjs | null] | null;

function toSortableDate(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toSortableMonth(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const day = toSortableDate(s);
  return day ? day.slice(0, 7) : undefined;
}

export function isInDateRange(
  raw: string | undefined | null,
  range: DateRangeValue,
  picker: "date" | "month" = "date",
): boolean {
  if (!range || (!range[0] && !range[1])) return true;
  if (!raw) return false;
  const value = picker === "month" ? toSortableMonth(raw) : toSortableDate(raw);
  if (!value) return false;
  const from = range[0]
    ? picker === "month"
      ? range[0].format("YYYY-MM")
      : range[0].format("YYYY-MM-DD")
    : undefined;
  const to = range[1]
    ? picker === "month"
      ? range[1].format("YYYY-MM")
      : range[1].format("YYYY-MM-DD")
    : undefined;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function getRecordDate<T extends object>(
  row: T,
  field: string | ((row: T) => string | undefined | null),
): string | undefined {
  if (typeof field === "function") {
    const v = field(row);
    return v?.trim() ? v : undefined;
  }
  const v = (row as Record<string, unknown>)[field];
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function earliestDate(...values: Array<string | undefined | null>): string | undefined {
  const dates = values.map((v) => (v ? toSortableDate(v) : undefined)).filter((v): v is string => Boolean(v));
  if (!dates.length) return undefined;
  dates.sort();
  return dates[0];
}
