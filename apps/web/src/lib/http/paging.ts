export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export const LIST_PAGE_SIZE = 50;
export const CATALOG_PAGE_SIZE = 100;

export function unwrapList<T>(data: PageResult<T> | T[] | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export type FetchedPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export async function fetchPage<T>(
  load: (page: number, pageSize: number) => Promise<PageResult<T> | T[]>,
  page = 1,
  pageSize = LIST_PAGE_SIZE,
): Promise<FetchedPage<T>> {
  const data = await load(page, pageSize);
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      page: 1,
      pageSize: data.length || pageSize,
      hasMore: false,
    };
  }
  const items = data.items ?? [];
  const size = data.pageSize || pageSize;
  const total = data.total ?? items.length;
  const current = data.page ?? page;
  return {
    items,
    total,
    page: current,
    pageSize: size,
    hasMore: current * size < total,
  };
}

/** Caps at 3 pages — catalogs only. List screens should use fetchPage. */
export async function fetchAllPages<T>(
  load: (page: number, pageSize: number) => Promise<PageResult<T> | T[]>,
): Promise<T[]> {
  const pageSize = CATALOG_PAGE_SIZE;
  const first = await fetchPage(load, 1, pageSize);
  if (!first.hasMore) return first.items;
  const maxPages = Math.min(3, Math.max(1, Math.ceil(first.total / first.pageSize)));
  const rest = await Promise.all(
    Array.from({ length: maxPages - 1 }, (_, i) => fetchPage(load, i + 2, pageSize)),
  );
  return rest.reduce((acc, next) => acc.concat(next.items), first.items);
}
