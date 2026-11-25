import { describe, expect, it } from "vitest";
import type { ApiNote } from "@/modules/notes/model";
import { threadNotes } from "@/modules/notes/threads";

const MAI = "22222222-2222-4222-8222-222222222222";
const HUNG = "33333333-3333-4333-8333-333333333333";
const LAN = "44444444-4444-4444-8444-444444444444";

function note(partial: Partial<ApiNote> & Pick<ApiNote, "id" | "createdAt" | "content">): ApiNote {
  return {
    subjectType: "ORDER",
    subjectId: "order-1",
    authorUserId: HUNG,
    authorName: "Hùng",
    mentionedUserIds: [],
    mentionedUserNames: [],
    parentId: null,
    updatedAt: partial.createdAt,
    ...partial,
  };
}

describe("threadNotes", () => {
  it("keeps ordinary comments in one level, oldest first", () => {
    const older = note({ id: "a", createdAt: "2026-11-19T01:00:00.000Z", content: "Cũ" });
    const newer = note({ id: "b", createdAt: "2026-11-20T01:00:00.000Z", content: "Mới", authorUserId: MAI, authorName: "Mai" });
    const threads = threadNotes([newer, older]);
    expect(threads.map((thread) => thread.note.id)).toEqual(["a", "b"]);
    expect(threads.every((thread) => thread.replies.length === 0)).toBe(true);
  });

  it("nests a leading @mention under the latest earlier comment by that person", () => {
    const mai = note({
      id: "mai",
      createdAt: "2026-11-20T01:00:00.000Z",
      content: "Nhờ xem hợp đồng",
      authorUserId: MAI,
      authorName: "Mai Trần",
    });
    const other = note({
      id: "other",
      createdAt: "2026-11-20T02:00:00.000Z",
      content: "Ghi chú riêng",
      authorUserId: LAN,
      authorName: "Lan",
    });
    const reply = note({
      id: "reply",
      createdAt: "2026-11-20T03:00:00.000Z",
      content: "@Mai Trần đã xem",
      authorUserId: HUNG,
      authorName: "Hùng",
      mentionedUserIds: [MAI],
      mentionedUserNames: ["Mai Trần"],
    });
    const threads = threadNotes([reply, other, mai]);
    expect(threads.map((thread) => thread.note.id)).toEqual(["mai", "other"]);
    expect(threads[0]?.replies.map((item) => item.id)).toEqual(["reply"]);
  });

  it("keeps a reply to a reply on the same root", () => {
    const mai = note({
      id: "mai",
      createdAt: "2026-11-20T01:00:00.000Z",
      content: "Gốc",
      authorUserId: MAI,
      authorName: "Mai",
    });
    const hung = note({
      id: "hung",
      createdAt: "2026-11-20T02:00:00.000Z",
      content: "@Mai ok",
      authorUserId: HUNG,
      authorName: "Hùng",
      mentionedUserIds: [MAI],
      mentionedUserNames: ["Mai"],
    });
    const lan = note({
      id: "lan",
      createdAt: "2026-11-20T03:00:00.000Z",
      content: "@Hùng thêm giúp",
      authorUserId: LAN,
      authorName: "Lan",
      mentionedUserIds: [HUNG],
      mentionedUserNames: ["Hùng"],
    });
    const threads = threadNotes([mai, hung, lan]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((item) => item.id)).toEqual(["hung", "lan"]);
  });

  it("does not nest a mention that is not at the start", () => {
    const mai = note({
      id: "mai",
      createdAt: "2026-11-20T01:00:00.000Z",
      content: "Gốc",
      authorUserId: MAI,
      authorName: "Mai",
    });
    const comment = note({
      id: "top",
      createdAt: "2026-11-20T02:00:00.000Z",
      content: "Nhờ @Mai xem lại",
      mentionedUserIds: [MAI],
      mentionedUserNames: ["Mai"],
    });
    const threads = threadNotes([mai, comment]);
    expect(threads.map((thread) => thread.note.id)).toEqual(["mai", "top"]);
  });

  it("leaves a leading mention as a root when that person has not commented yet", () => {
    const comment = note({
      id: "top",
      createdAt: "2026-11-20T02:00:00.000Z",
      content: "@Mai xem giúp",
      mentionedUserIds: [MAI],
      mentionedUserNames: ["Mai"],
    });
    expect(threadNotes([comment])).toEqual([{ note: comment, replies: [] }]);
  });

  it("prefers an explicit parent id over the mention heuristic", () => {
    const maiId = "55555555-5555-4555-8555-555555555555";
    const lanId = "66666666-6666-4666-8666-666666666666";
    const replyId = "77777777-7777-4777-8777-777777777777";
    const mai = note({
      id: maiId,
      createdAt: "2026-11-20T01:00:00.000Z",
      content: "Gốc của Mai",
      authorUserId: MAI,
      authorName: "Mai",
    });
    const lan = note({
      id: lanId,
      createdAt: "2026-11-20T01:30:00.000Z",
      content: "Gốc của Lan",
      authorUserId: LAN,
      authorName: "Lan",
    });
    const reply = note({
      id: replyId,
      createdAt: "2026-11-20T02:00:00.000Z",
      content: "@Mai nhầm người",
      authorUserId: HUNG,
      authorName: "Hùng",
      mentionedUserIds: [MAI],
      mentionedUserNames: ["Mai"],
      parentId: lanId,
    });
    const threads = threadNotes([mai, lan, reply]);
    expect(threads.find((thread) => thread.note.id === maiId)?.replies).toEqual([]);
    expect(threads.find((thread) => thread.note.id === lanId)?.replies.map((item) => item.id)).toEqual([replyId]);
  });

  it("flattens an explicit reply-to-reply onto the root", () => {
    const rootId = "55555555-5555-4555-8555-555555555555";
    const childId = "66666666-6666-4666-8666-666666666666";
    const grandId = "77777777-7777-4777-8777-777777777777";
    const root = note({ id: rootId, createdAt: "2026-11-20T01:00:00.000Z", content: "Gốc", authorUserId: MAI, authorName: "Mai" });
    const child = note({
      id: childId,
      createdAt: "2026-11-20T02:00:00.000Z",
      content: "Một",
      parentId: rootId,
    });
    const grandchild = note({
      id: grandId,
      createdAt: "2026-11-20T03:00:00.000Z",
      content: "Hai",
      authorUserId: LAN,
      authorName: "Lan",
      parentId: childId,
    });
    const threads = threadNotes([root, child, grandchild]);
    expect(threads).toHaveLength(1);
    expect(threads[0]?.replies.map((item) => item.id)).toEqual([childId, grandId]);
  });
});
