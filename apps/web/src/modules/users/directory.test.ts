import { describe, expect, it } from "vitest";
import { unwrapDirectory } from "@/modules/users/directory";

const MAI = "22222222-2222-4222-8222-222222222222";

describe("unwrapDirectory", () => {
  it("keeps active directory rows and drops names used as ids", () => {
    expect(
      unwrapDirectory([
        { id: MAI, displayName: "Mai Trần", email: "mai@example.com" },
        { id: "Mai Trần", displayName: "Mai Trần", email: "mai@example.com" },
        { id: MAI, displayName: "Mai Trần", email: "mai@example.com" },
      ]),
    ).toEqual([{ id: MAI, displayName: "Mai Trần", email: "mai@example.com" }]);
  });

  it("reads a paged payload and an empty failure shape", () => {
    expect(unwrapDirectory({ items: [{ id: MAI, displayName: "", email: "mai@example.com" }] })).toEqual([
      { id: MAI, displayName: "mai@example.com", email: "mai@example.com" },
    ]);
    expect(unwrapDirectory(null)).toEqual([]);
  });
});
