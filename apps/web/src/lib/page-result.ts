import type { PageResult } from "@/lib/http/paging";

export class PageShapeError extends Error {
  constructor() {
    super("UNEXPECTED_PAGE_SHAPE");
    this.name = "PageShapeError";
  }
}

function unwrapData(raw: unknown): unknown {
  if (raw && typeof raw === "object" && "data" in raw) {
    const data = (raw as { data: unknown }).data;
    if (data && typeof data === "object") return data;
  }
  return raw;
}

function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Accept a bare array or a page wrapper (`items` / `results` / `records` / `content`,
 * optionally inside `data`). Anything else is an error so the UI does not look empty.
 */
export function parsePage<T>(raw: unknown): PageResult<T> {
  const body = unwrapData(raw);
  if (Array.isArray(body)) {
    return { items: body as T[], total: body.length, page: 1, pageSize: body.length || 20 };
  }
  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    const list = record.items ?? record.results ?? record.records ?? record.content;
    if (Array.isArray(list)) {
      return {
        items: list as T[],
        total: asNumber(record.total ?? record.totalCount ?? record.totalElements, list.length),
        page: asNumber(record.page ?? record.pageNumber ?? record.number, 1),
        pageSize: asNumber(record.pageSize ?? record.size, list.length || 20),
      };
    }
  }
  throw new PageShapeError();
}
