import { describe, expect, it } from "vitest";
import { resolveOrderDetailTab } from "@/lib/order-detail-tab";

describe("resolveOrderDetailTab", () => {
  it("opens Trao đổi from ?tab=notes when the user can view orders", () => {
    expect(resolveOrderDetailTab("notes", true)).toBe("notes");
    expect(resolveOrderDetailTab("documents", true)).toBe("documents");
    expect(resolveOrderDetailTab("license", true)).toBe("license");
    expect(resolveOrderDetailTab(null, true)).toBe("expenses");
  });

  it("ignores the notes deep link without order.view", () => {
    expect(resolveOrderDetailTab("notes", false)).toBe("expenses");
  });
});
