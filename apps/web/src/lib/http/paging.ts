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
  if (totalPages <= 1) return items;
  const rest = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, i) => load(i + 2, pageSize)),
  );
  for (const next of rest) items.push(...unwrapList(next));
  return items;
}
