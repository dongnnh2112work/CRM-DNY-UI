import { describe, expect, it } from "vitest";
import {
  activeMentionQuery,
  mentionIdsInText,
  relativeAge,
  splitMentionTokens,
} from "@/modules/notes/mentions";

const MAI = "22222222-2222-4222-8222-222222222222";
const HUNG = "33333333-3333-4333-8333-333333333333";

describe("activeMentionQuery", () => {
  it("reads the live @ query, including spaces in a name", () => {
    expect(activeMentionQuery("Nhờ @")).toEqual({ start: 4, query: "" });
    expect(activeMentionQuery("Nhờ @Mai")).toEqual({ start: 4, query: "Mai" });
    expect(activeMentionQuery("Nhờ @Mai Trần")).toEqual({ start: 4, query: "Mai Trần" });
  });

  it("ignores an @ glued to a word and a query on a previous line", () => {
    expect(activeMentionQuery("mail mai@dyn.vn")).toBeNull();
    expect(activeMentionQuery("Nhờ @Mai\nthêm")).toBeNull();
  });
});

describe("mention tokens", () => {
  const users = [
    { id: MAI, displayName: "Mai Trần" },
    { id: HUNG, displayName: "Hùng" },
  ];

  it("highlights only selected people and keeps other @text plain", () => {
    const content = "Nhờ @Mai Trần xem, không phải @KhôngCó. Cc @Hùng.";
    expect(splitMentionTokens(content, users)).toEqual([
      { kind: "text", text: "Nhờ " },
      { kind: "mention", id: MAI, displayName: "Mai Trần" },
      { kind: "text", text: " xem, không phải @KhôngCó. Cc " },
      { kind: "mention", id: HUNG, displayName: "Hùng" },
      { kind: "text", text: "." },
    ]);
  });

  it("prefers the longer name when one display name contains another", () => {
    const content = "@Mai Trần";
    const segments = splitMentionTokens(content, [
      { id: MAI, displayName: "Mai Trần" },
      { id: HUNG, displayName: "Mai" },
    ]);
    expect(segments).toEqual([{ kind: "mention", id: MAI, displayName: "Mai Trần" }]);
  });

  it("drops a mention id once its token is gone from the text", () => {
    expect(mentionIdsInText("Chỉ còn @Hùng thôi", users)).toEqual([HUNG]);
    expect(mentionIdsInText("Không còn ai", users)).toEqual([]);
    expect(mentionIdsInText("@KhôngCó", users)).toEqual([]);
  });
});

describe("relativeAge", () => {
  const now = Date.parse("2026-11-20T04:00:00.000Z");

  it("buckets recent comments and falls back after a week", () => {
    expect(relativeAge("2026-11-20T03:59:40.000Z", now)).toEqual({ unit: "justNow" });
    expect(relativeAge("2026-11-20T03:30:00.000Z", now)).toEqual({ unit: "minutes", n: 30 });
    expect(relativeAge("2026-11-20T01:00:00.000Z", now)).toEqual({ unit: "hours", n: 3 });
    expect(relativeAge("2026-11-18T04:00:00.000Z", now)).toEqual({ unit: "days", n: 2 });
    expect(relativeAge("2026-11-01T04:00:00.000Z", now)).toEqual({ unit: "absolute" });
  });
});
