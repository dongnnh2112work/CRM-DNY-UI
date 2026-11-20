import { isUuid } from "@/lib/http/message";

export type MentionRef = {
  id: string;
  displayName: string;
};

export type MentionSegment =
  | { kind: "text"; text: string }
  | { kind: "mention"; id: string; displayName: string };

const LEAD = /\s/;
const TRAIL = /[\s.,!?;:，。、)\]】]/;

/**
 * The unfinished `@query` at the caret, if the caret is still inside one.
 * Names may contain spaces. A newline or an `@` glued to a word ends the query.
 */
export function activeMentionQuery(textBeforeCaret: string): { start: number; query: string } | null {
  for (let index = textBeforeCaret.length - 1; index >= 0; index -= 1) {
    const char = textBeforeCaret[index] ?? "";
    if (char === "\n" || char === "\r") return null;
    if (char !== "@") continue;
    const previous = index === 0 ? "" : (textBeforeCaret[index - 1] ?? "");
    if (previous !== "" && !LEAD.test(previous)) return null;
    const query = textBeforeCaret.slice(index + 1);
    if (query.length > 60) return null;
    return { start: index, query };
  }
  return null;
}

function mentionUsers(users: readonly MentionRef[]): MentionRef[] {
  const seen = new Set<string>();
  const list: MentionRef[] = [];
  for (const user of users) {
    const displayName = user.displayName.trim();
    const id = user.id.trim();
    if (!isUuid(id) || !displayName || seen.has(id)) continue;
    seen.add(id);
    list.push({ id, displayName });
  }
  return list;
}

/**
 * Split plain note text into words and the `@displayName` tokens that belong
 * to people actually mentioned. A typed `@name` that was never selected stays plain.
 */
export function splitMentionTokens(content: string, users: readonly MentionRef[]): MentionSegment[] {
  const named = mentionUsers(users).sort((a, b) => b.displayName.length - a.displayName.length);
  const hits: { start: number; end: number; user: MentionRef }[] = [];
  const overlaps = (start: number, end: number) => hits.some((hit) => start < hit.end && end > hit.start);

  for (const user of named) {
    const needle = `@${user.displayName}`;
    let from = 0;
    while (from <= content.length - needle.length) {
      const start = content.indexOf(needle, from);
      if (start < 0) break;
      const end = start + needle.length;
      const previous = start === 0 ? "" : (content[start - 1] ?? "");
      const next = end >= content.length ? "" : (content[end] ?? "");
      const leftOk = previous === "" || LEAD.test(previous);
      const rightOk = next === "" || TRAIL.test(next);
      if (leftOk && rightOk && !overlaps(start, end)) hits.push({ start, end, user });
      from = start + needle.length;
    }
  }

  hits.sort((a, b) => a.start - b.start);
  const segments: MentionSegment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start > cursor) segments.push({ kind: "text", text: content.slice(cursor, hit.start) });
    segments.push({ kind: "mention", id: hit.user.id, displayName: hit.user.displayName });
    cursor = hit.end;
  }
  if (cursor < content.length || segments.length === 0) {
    segments.push({ kind: "text", text: content.slice(cursor) });
  }
  return segments;
}

/** Ids whose `@displayName` token is still in the text, in first-seen order. */
export function mentionIdsInText(content: string, users: readonly MentionRef[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const segment of splitMentionTokens(content, users)) {
    if (segment.kind !== "mention" || seen.has(segment.id)) continue;
    seen.add(segment.id);
    ids.push(segment.id);
  }
  return ids;
}

export type RelativeAge =
  | { unit: "justNow" }
  | { unit: "minutes" | "hours" | "days"; n: number }
  | { unit: "absolute" };

export function relativeAge(iso: string, now = Date.now()): RelativeAge {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return { unit: "absolute" };
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return { unit: "justNow" };
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return { unit: "minutes", n: Math.max(1, minutes) };
  const hours = Math.round(minutes / 60);
  if (hours < 24) return { unit: "hours", n: Math.max(1, hours) };
  const days = Math.round(hours / 24);
  if (days < 7) return { unit: "days", n: Math.max(1, days) };
  return { unit: "absolute" };
}
