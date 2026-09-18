import type { TableColumnsType } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";

dayjs.extend(customParseFormat);

export const DISPLAY_DATE_FORMAT = "DD/MM/YYYY";
export const DISPLAY_MONTH_FORMAT = "MM/YYYY";
export const DISPLAY_DATETIME_FORMAT = "DD/MM/YYYY HH:mm";
export const STORAGE_DATE_FORMAT = "YYYY-MM-DD";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH = /^\d{4}-\d{2}$/;
const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const DISPLAY_DATE = /^\d{2}\/\d{2}\/\d{4}$/;

export function parseToDayjs(value: string | number | Date | Dayjs): Dayjs | null {
  if (dayjs.isDayjs(value)) return value.isValid() ? value : null;
  if (value instanceof Date) {
    const d = dayjs(value);
    return d.isValid() ? d : null;
  }
  if (typeof value === "number") {
    const d = dayjs(value);
    return d.isValid() ? d : null;
  }
  const s = value.trim();
  if (!s) return null;
  if (ISO_DATE.test(s)) {
    const d = dayjs(s, STORAGE_DATE_FORMAT, true);
    return d.isValid() ? d : null;
  }
  if (ISO_MONTH.test(s)) {
    const d = dayjs(s, "YYYY-MM", true);
    return d.isValid() ? d : null;
  }
  if (DISPLAY_DATE.test(s)) {
    const d = dayjs(s, DISPLAY_DATE_FORMAT, true);
    return d.isValid() ? d : null;
  }
  const d = dayjs(s);
  return d.isValid() ? d : null;
}

export function looksLikeIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const s = value.trim();
  return ISO_DATE.test(s) || ISO_MONTH.test(s) || ISO_DATETIME.test(s);
}

/** Form DatePicker may store Dayjs or a DD/MM/YYYY string. Persist as YYYY-MM-DD. */
export function toStorageDate(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (dayjs.isDayjs(value)) {
    return value.isValid() ? value.format(STORAGE_DATE_FORMAT) : undefined;
  }
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const d = parseToDayjs(value);
    return d ? d.format(STORAGE_DATE_FORMAT) : undefined;
  }
  return undefined;
}

export function formatDisplayDate(value?: string | number | Date | null, empty = "—"): string {
  if (value == null || value === "") return empty;
  const d = parseToDayjs(value);
  if (!d) return String(value);
  const raw = typeof value === "string" ? value.trim() : "";
  if (ISO_MONTH.test(raw) && !ISO_DATE.test(raw)) return d.format(DISPLAY_MONTH_FORMAT);
  if (
    value instanceof Date ||
    typeof value === "number" ||
    ISO_DATETIME.test(raw) ||
    (raw.includes("T") && raw.length > 10)
  ) {
    return d.format(DISPLAY_DATETIME_FORMAT);
  }
  return d.format(DISPLAY_DATE_FORMAT);
}

export function formatDisplayDateTime(value?: string | number | Date | null, empty = "—"): string {
  if (value == null || value === "") return empty;
  const d = parseToDayjs(value);
  if (!d) return String(value);
  return d.format(DISPLAY_DATETIME_FORMAT);
}

export function formatIfDateLike<T>(value: T): T | string {
  if (!looksLikeIsoDate(value)) return value;
  return formatDisplayDate(value);
}

export function dateSearchHaystack(value: string): string[] {
  const formatted = looksLikeIsoDate(value) ? formatDisplayDate(value, "") : "";
  return formatted ? [value, formatted] : [value];
}

export function rangePickerFormat(picker: "date" | "month" = "date"): string {
  return picker === "month" ? DISPLAY_MONTH_FORMAT : DISPLAY_DATE_FORMAT;
}

export function withDisplayDates<T extends object>(columns: TableColumnsType<T>): TableColumnsType<T> {
  return columns.map((col) => {
    if (!col || typeof col !== "object") return col;
    const originalRender = "render" in col ? col.render : undefined;
    return {
      ...col,
      render: (value: unknown, record: T, index: number) => {
        const rendered = originalRender
          ? originalRender(value as never, record, index)
          : value;
        return formatIfDateLike(rendered);
      },
    };
  }) as TableColumnsType<T>;
}
