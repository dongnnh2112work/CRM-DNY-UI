import { apiRequest } from "@/lib/http/client";
import { isUuid } from "@/lib/http/message";

export type DirectoryUser = {
  id: string;
  displayName: string;
  email: string;
};

type Fields = { [key: string]: unknown };

function fields(value: unknown): Fields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Fields;
}

function listed(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = fields(raw);
  if (!record) return [];
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  const nested = fields(record.data);
  if (nested && Array.isArray(nested.items)) return nested.items;
  return [];
}

export function normalizeDirectoryUser(raw: unknown): DirectoryUser | null {
  const record = fields(raw);
  if (!record) return null;
  const nested = fields(record.data);
  const data = nested && typeof nested.id === "string" && typeof record.id !== "string" ? nested : record;
  if (typeof data.id !== "string" || !isUuid(data.id)) return null;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  const displayName = typeof data.displayName === "string" ? data.displayName.trim() : "";
  if (!displayName && !email) return null;
  return { id: data.id, displayName: displayName || email, email };
}

export function unwrapDirectory(raw: unknown): DirectoryUser[] {
  const seen = new Set<string>();
  const users: DirectoryUser[] = [];
  for (const item of listed(raw)) {
    const user = normalizeDirectoryUser(item);
    if (!user || seen.has(user.id)) continue;
    seen.add(user.id);
    users.push(user);
  }
  return users;
}

export const usersDirectoryApi = {
  async search(q: string): Promise<DirectoryUser[]> {
    const params = new URLSearchParams({ q });
    const raw = await apiRequest<unknown>(`/users/directory?${params.toString()}`);
    return unwrapDirectory(raw);
  },
};
