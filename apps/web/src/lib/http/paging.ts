export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export function unwrapList<T>(data: PageResult<T> | T[] | undefined | null): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.items ?? [];
}

export async function fetchAllPages<T>(
  load: (page: number, pageSize: number) => Promise<PageResult<T> | T[]>,
): Promise<T[]> {
  const pageSize = 100;
  const first = await load(1, pageSize);
  if (Array.isArray(first)) return first;
  const items = [...(first.items ?? [])];
  const size = first.pageSize || pageSize;
  const totalPages = Math.max(1, Math.ceil((first.total || items.length) / size));
  for (let page = 2; page <= totalPages; page++) {
    const next = await load(page, pageSize);
    items.push(...unwrapList(next));
  }
  return items;
}
