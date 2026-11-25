import { describe, expect, it } from "vitest";
import {
  buildOrderNotePayload,
  buildOrderNoteUpdate,
  noteWasEdited,
  sortNotesNewestFirst,
  unwrapNotes,
  type ApiNote,
} from "@/modules/notes/model";

const HUNG = "11111111-1111-4111-8111-111111111111";
const MAI = "22222222-2222-4222-8222-222222222222";

function note(partial: Partial<ApiNote> & Pick<ApiNote, "id" | "createdAt">): ApiNote {
  return {
    subjectType: "ORDER",
    subjectId: "order-1",
    content: partial.id,
    authorUserId: HUNG,
    authorName: "Hùng",
    mentionedUserIds: [],
    mentionedUserNames: [],
    parentId: null,
    updatedAt: partial.createdAt,
    ...partial,
  };
}

describe("order note payload", () => {
  it("sends selected user ids and leaves names in the text alone", () => {
    expect(
      buildOrderNotePayload({
        orderId: "order-1",
        content: "  Nhờ @Mai kiểm tra  ",
        mentionedUserIds: [HUNG, "Mai", HUNG],
      }),
    ).toEqual({
      subjectType: "ORDER",
      subjectId: "order-1",
      content: "Nhờ @Mai kiểm tra",
      mentionedUserIds: [HUNG],
    });
  });

  it("omits mentionedUserIds when nobody was selected", () => {
    expect(
      buildOrderNotePayload({
        orderId: "order-1",
        content: "Không nhắc ai",
        mentionedUserIds: ["không phải uuid"],
      }),
    ).toEqual({
      subjectType: "ORDER",
      subjectId: "order-1",
      content: "Không nhắc ai",
    });
  });

  it("sends an empty mention list on edit so cleared tags are removed", () => {
    expect(buildOrderNoteUpdate({ content: " Đã bỏ nhắc ", mentionedUserIds: ["Mai"] })).toEqual({
      content: "Đã bỏ nhắc",
      mentionedUserIds: [],
    });
  });
});

describe("note list", () => {
  it("unwraps an array or a page and sorts newest first", () => {
    const older = note({ id: "a", createdAt: "2026-11-19T01:00:00.000Z", content: "cũ" });
    const newer = note({ id: "b", createdAt: "2026-11-20T01:00:00.000Z", content: "mới" });
    expect(sortNotesNewestFirst(unwrapNotes([older, newer])).map((item) => item.id)).toEqual(["b", "a"]);
    expect(sortNotesNewestFirst(unwrapNotes({ items: [older, newer] })).map((item) => item.content)).toEqual([
      "mới",
      "cũ",
    ]);
    expect(unwrapNotes({ data: { items: [newer] } })).toHaveLength(1);
    expect(unwrapNotes(null)).toEqual([]);
  });

  it("fills missing mention arrays and keeps a wrapped note", () => {
    const [parsed] = unwrapNotes([
      {
        id: "n1",
        content: "Xin chào",
        authorUserId: MAI,
        createdAt: "2026-11-20T04:00:00.000Z",
      },
    ]);
    expect(parsed?.mentionedUserIds).toEqual([]);
    expect(parsed?.parentId).toBeNull();
    expect(parsed?.authorName).toBe("");
    expect(normalizeWrapped()).toMatchObject({ id: "n1", content: "Xin chào", authorName: "Mai" });
  });

  it("keeps a parent id when the server sends one", () => {
    const [parsed] = unwrapNotes([
      {
        id: "child",
        content: "reply",
        createdAt: "2026-11-20T04:00:00.000Z",
        parentId: MAI,
      },
    ]);
    expect(parsed?.parentId).toBe(MAI);
    const [ignored] = unwrapNotes([
      {
        id: "child",
        content: "reply",
        createdAt: "2026-11-20T04:00:00.000Z",
        parentId: "not-a-uuid",
      },
    ]);
    expect(ignored?.parentId).toBeNull();
  });

  it("marks a note edited only when updatedAt moves", () => {
    const created = note({ id: "a", createdAt: "2026-11-20T04:00:00.000Z" });
    expect(noteWasEdited(created)).toBe(false);
    expect(
      noteWasEdited({ ...created, updatedAt: "2026-11-20T04:00:00.500Z" }),
    ).toBe(false);
    expect(
      noteWasEdited({ ...created, updatedAt: "2026-11-20T05:00:00.000Z" }),
    ).toBe(true);
  });
});

function normalizeWrapped() {
  return unwrapNotes({
    data: {
      id: "n1",
      content: "Xin chào",
      authorName: "Mai",
      authorUserId: MAI,
      createdAt: "2026-11-20T04:00:00.000Z",
    },
  })[0];
}
