import { ApiError } from "@/lib/http/errors";
import { isUuid } from "@/lib/http/message";

export type ApiNote = {
  id: string;
  subjectType: string;
  subjectId: string;
  content: string;
  authorUserId: string;
  authorName: string;
  mentionedUserIds: string[];
  mentionedUserNames: string[];
  createdAt: string;
  updatedAt: string;
};

export type OrderNotePayload = {
  subjectType: "ORDER";
  subjectId: string;
  content: string;
  mentionedUserIds?: string[];
};

export type OrderNoteUpdate = {
  content: string;
  mentionedUserIds: string[];
};

export type HttpProblem = "forbidden" | "missing" | "error";

type Fields = { [key: string]: unknown };

function fields(value: unknown): Fields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Fields;
}

function readString(source: Fields, key: string) {
  const value = source[key];
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/** Keep real user ids only. A typed name is never a mention. */
export function uniqueMentionIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!isUuid(trimmed) || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

/**
 * Mentions are the people chosen in the picker.
 * Text such as "@Mai" stays in the content and is not turned into an id.
 */
export function buildOrderNotePayload(input: {
  orderId: string;
  content: string;
  mentionedUserIds: readonly string[];
}): OrderNotePayload {
  const mentionedUserIds = uniqueMentionIds(input.mentionedUserIds);
  return {
    subjectType: "ORDER",
    subjectId: input.orderId,
    content: input.content.trim(),
    ...(mentionedUserIds.length ? { mentionedUserIds } : {}),
  };
}

export function buildOrderNoteUpdate(input: {
  content: string;
  mentionedUserIds: readonly string[];
}): OrderNoteUpdate {
  return {
    content: input.content.trim(),
    mentionedUserIds: uniqueMentionIds(input.mentionedUserIds),
  };
}

function noteFields(raw: unknown): Fields | null {
  const record = fields(raw);
  if (!record) return null;
  const nested = fields(record.data);
  if (nested && typeof nested.id === "string" && typeof record.id !== "string") return nested;
  return record;
}

export function normalizeNote(raw: unknown): ApiNote | null {
  const data = noteFields(raw);
  if (!data || typeof data.id !== "string") return null;
  const createdAt = readString(data, "createdAt");
  return {
    id: data.id,
    subjectType: readString(data, "subjectType") || "ORDER",
    subjectId: readString(data, "subjectId"),
    content: readString(data, "content"),
    authorUserId: readString(data, "authorUserId"),
    authorName: readString(data, "authorName"),
    mentionedUserIds: stringList(data.mentionedUserIds),
    mentionedUserNames: stringList(data.mentionedUserNames),
    createdAt,
    updatedAt: readString(data, "updatedAt") || createdAt,
  };
}

export function unwrapNotes(raw: unknown): ApiNote[] {
  const list = listed(raw);
  const source = list.length ? list : [raw];
  return source.map(normalizeNote).filter((note): note is ApiNote => note != null);
}

export function sortNotesNewestFirst(notes: readonly ApiNote[]): ApiNote[] {
  return [...notes].sort((a, b) => {
    const left = Date.parse(a.createdAt);
    const right = Date.parse(b.createdAt);
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return right - left;
    return 0;
  });
}

export function noteWasEdited(note: ApiNote): boolean {
  if (!note.updatedAt || note.updatedAt === note.createdAt) return false;
  const created = Date.parse(note.createdAt);
  const updated = Date.parse(note.updatedAt);
  if (!Number.isFinite(created) || !Number.isFinite(updated)) return true;
  return updated - created > 1000;
}

export function httpProblem(err: unknown): HttpProblem {
  if (err instanceof ApiError) {
    if (err.statusCode === 403) return "forbidden";
    if (err.statusCode === 404) return "missing";
  }
  return "error";
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
