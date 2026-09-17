type RequestLike = {
  method?: string;
  body?: BodyInit | null;
};

const LIST_SEGMENTS = new Set([
  "services",
  "customers",
  "orders",
  "payments",
  "expenses",
  "users",
  "roles",
  "documents",
  "notifications",
  "collaborators",
  "commissions",
  "vat-invoices",
  "contracts",
  "config",
]);

const ACTION_SEGMENTS = new Set([
  "archive",
  "approve",
  "reject",
  "read",
  "verify",
  "void",
  "issue",
  "cancel",
  "assign",
  "change-stage",
  "deactivate",
  "calculate",
  "pay",
  "roles",
  "payment-schedule",
]);

function parseBody(raw: BodyInit | null | undefined): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof FormData !== "undefined" && raw instanceof FormData) {
    const file = raw.get("file");
    return {
      fileName: file instanceof File ? file.name : "file",
      mimeType: file instanceof File ? file.type : null,
    };
  }
  return {};
}

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const memory = new Map<string, Record<string, unknown>>();

function collectionOf(parts: string[]) {
  return parts[0] ?? "local";
}

function resourcePath(collection: string, id: string) {
  return `/${collection}/${id}`;
}

/** Fake REST payload so local login-bypass can create/update without a real token. */
export function mockDevBypassApi<T>(path: string, init: RequestLike = {}): T {
  const method = (init.method ?? "GET").toUpperCase();
  const now = new Date().toISOString();
  const pathname = path.split("?")[0];
  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1] ?? "local";
  const collection = collectionOf(parts);

  if (method === "GET") {
    if (path.includes("?") || LIST_SEGMENTS.has(last) || ACTION_SEGMENTS.has(last)) {
      return { items: [], total: 0, page: 1, pageSize: 20 } as T;
    }
    const stored = memory.get(pathname);
    if (stored) return stored as T;
    return { id: last, createdAt: now, updatedAt: now } as T;
  }

  if (method === "DELETE") {
    memory.delete(pathname);
    return undefined as T;
  }

  const body = parseBody(init.body);
  const isAction = ACTION_SEGMENTS.has(last);
  const id = isAction || method !== "POST" ? (isAction ? parts[parts.length - 2] : last) : newLocalId();
  const key = resourcePath(collection, id);
  const existing = memory.get(key) ?? {};

  const record = {
    ...existing,
    id,
    ...body,
    createdAt: typeof body.createdAt === "string" ? body.createdAt : (existing.createdAt as string | undefined) ?? now,
    updatedAt: now,
    status: last === "archive" || last === "deactivate" ? "ARCHIVED" : (body.status ?? existing.status ?? "ACTIVE"),
    customFields: body.customFields ?? existing.customFields ?? {},
    downloadUrl: last.includes("download") ? "#" : existing.downloadUrl,
  };
  memory.set(key, record);
  return record as T;
}
