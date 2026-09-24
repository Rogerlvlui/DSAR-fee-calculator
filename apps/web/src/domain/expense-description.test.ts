import { describe, expect, it } from "vitest";
import { hasSufficientDescriptionForCategory } from "./expense-description.ts";

describe("EXPENSE-DESCRIPTION: hasSufficientDescriptionForCategory", () => {
  it("EXPENSE-DESCRIPTION: refuses a short or blank OTHER_UNCLASSIFIED description", () => {
    expect(hasSufficientDescriptionForCategory("OTHER_UNCLASSIFIED", "")).toBe(false);
    expect(hasSufficientDescriptionForCategory("OTHER_UNCLASSIFIED", "misc")).toBe(false);
    // Whitespace doesn't count toward the minimum.
    expect(hasSufficientDescriptionForCategory("OTHER_UNCLASSIFIED", "a b c d e f g h i")).toBe(false);
  });

  it("EXPENSE-DESCRIPTION: accepts 10+ non-whitespace characters for OTHER_UNCLASSIFIED", () => {
    expect(hasSufficientDescriptionForCategory("OTHER_UNCLASSIFIED", "Archive retrieval fee")).toBe(true);
    expect(hasSufficientDescriptionForCategory("OTHER_UNCLASSIFIED", "abcdefghij")).toBe(true);
  });

  it("EXPENSE-DESCRIPTION: places no extra requirement on any other category", () => {
    expect(hasSufficientDescriptionForCategory("POSTAGE_COURIER", "x")).toBe(true);
  });
});
