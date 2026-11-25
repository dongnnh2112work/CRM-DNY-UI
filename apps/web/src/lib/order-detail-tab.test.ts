import { describe, expect, it } from "vitest";
import { isOrderDiscussionDeepLink, resolveOrderDetailTab } from "@/lib/order-detail-tab";

describe("resolveOrderDetailTab", () => {
  it("keeps expenses, documents, and license tabs", () => {
    expect(resolveOrderDetailTab("documents")).toBe("documents");
    expect(resolveOrderDetailTab("license")).toBe("license");
    expect(resolveOrderDetailTab("expenses")).toBe("expenses");
    expect(resolveOrderDetailTab(null)).toBe("expenses");
  });

  it("does not treat discussion deep links as a tab", () => {
    expect(resolveOrderDetailTab("notes")).toBe("expenses");
    expect(resolveOrderDetailTab("discussion")).toBe("expenses");
  });
});

describe("isOrderDiscussionDeepLink", () => {
  it("recognizes ?tab=notes and ?tab=discussion", () => {
    expect(isOrderDiscussionDeepLink("notes")).toBe(true);
    expect(isOrderDiscussionDeepLink("discussion")).toBe(true);
    expect(isOrderDiscussionDeepLink("documents")).toBe(false);
    expect(isOrderDiscussionDeepLink(null)).toBe(false);
  });
});
