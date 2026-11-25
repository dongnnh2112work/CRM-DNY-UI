import { isUuid } from "@/lib/http/message";
import { splitMentionTokens, type MentionRef } from "@/modules/notes/mentions";
import type { ApiNote } from "@/modules/notes/model";

export type NoteThread = {
  note: ApiNote;
  replies: ApiNote[];
};

/**
 * One level of nesting, Facebook-style.
 *
 * The notes API has no parent column. `parentId` is used when a response
 * includes one. Otherwise a note is grouped under the latest earlier comment
 * by the person named in a leading @mention — the shape Reply writes.
 * A mention later in the sentence stays a top-level comment.
 * Replies never become parents; a reply to a reply hangs off the same root.
 */
export function threadNotes(notes: readonly ApiNote[]): NoteThread[] {
  const chronological = [...notes].sort((left, right) => {
    const a = Date.parse(left.createdAt);
    const b = Date.parse(right.createdAt);
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) return a - b;
    return 0;
  });

  const threads: NoteThread[] = [];
  const threadOf = new Map<string, NoteThread>();

  const attach = (note: ApiNote, parentId: string) => {
    const thread = threadOf.get(parentId);
    if (!thread || thread.note.id === note.id) return false;
    thread.replies.push(note);
    threadOf.set(note.id, thread);
    return true;
  };

  for (const note of chronological) {
    const explicit = note.parentId && isUuid(note.parentId) ? note.parentId : "";
    if (explicit) {
      if (!attach(note, explicit)) {
        const root: NoteThread = { note, replies: [] };
        threads.push(root);
        threadOf.set(note.id, root);
      }
      continue;
    }

    const lead = leadingMention(note);
    if (lead) {
      let parentId = "";
      for (const earlier of chronological) {
        if (earlier.id === note.id) break;
        if (earlier.authorUserId === lead.id) parentId = earlier.id;
      }
      if (parentId && attach(note, parentId)) continue;
    }

    const root: NoteThread = { note, replies: [] };
    threads.push(root);
    threadOf.set(note.id, root);
  }

  return threads;
}

export function noteMentions(note: ApiNote): MentionRef[] {
  return note.mentionedUserIds.flatMap((id, index) => {
    if (!isUuid(id)) return [];
    const displayName = note.mentionedUserNames[index]?.trim() ?? "";
    if (!displayName || isUuid(displayName)) return [];
    return [{ id, displayName }];
  });
}

export function leadingMention(note: ApiNote): MentionRef | null {
  const first = splitMentionTokens(note.content, noteMentions(note))[0];
  if (!first || first.kind !== "mention") return null;
  return { id: first.id, displayName: first.displayName };
}
