// tests/boundary/denylist-scanner.test.ts
//
// AC-06 / BOUND-02: the single normalize-and-match implementation both the
// Prisma field test and the DOM test import. PERSONAL_DATA_DENY_LIST is
// imported from packages/schemas — never restated here — so widening the
// list widens both checks automatically.

import { describe, expect, it } from "vitest";
import { findDenyListViolations, normalizeFieldName } from "./denylist-scanner.ts";
import { PERSONAL_DATA_DENY_LIST } from "@dsar/schemas/constants";

describe("normalizeFieldName", () => {
  it("lowercases, applies Unicode NFKC, and strips non-alphanumerics", () => {
    expect(normalizeFieldName("Requestor_Name!")).toBe("requestorname");
  });

  it("normalizes a full-width spelling to its ASCII equivalent (NFKC)", () => {
    // Full-width Latin "nric" (ｎｒｉｃ) — NFKC-normalizes
    // to ASCII "nric" before lowercasing/stripping.
    expect(normalizeFieldName("ｎｒｉｃ")).toBe("nric");
  });

  it("strips spaces, hyphens and other punctuation", () => {
    expect(normalizeFieldName("date of birth")).toBe("dateofbirth");
    expect(normalizeFieldName("date-of-birth")).toBe("dateofbirth");
  });
});

describe("findDenyListViolations", () => {
  it("reports a name whose normalized form contains a deny-list token", () => {
    const violations = findDenyListViolations(["requestorName"]);
    expect(violations).toEqual([{ name: "requestorName", matched: "requestorname" }]);
  });

  it("does not report a name that merely shares a prefix with a deny-list token", () => {
    // "requestorNote" shares the "requestorn" prefix with "requestorname"
    // but is not itself a match — a note field, not a name field.
    const violations = findDenyListViolations(["requestorNote"]);
    expect(violations).toEqual([]);
  });

  it("reports a full-width or diacritic spelling of a deny-listed token", () => {
    const violations = findDenyListViolations(["ｎｒｉｃ"]);
    expect(violations).toEqual([
      { name: "ｎｒｉｃ", matched: "nric" },
    ]);
  });

  it("reports a name matching two deny-list tokens exactly once", () => {
    const violations = findDenyListViolations(["requestorNameNric"]);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.name).toBe("requestorNameNric");
  });

  it("is unaffected by the order of the deny-list array", () => {
    const shuffled = [...PERSONAL_DATA_DENY_LIST].reverse();
    const names = ["requestorName", "requestorNote", "nric", "safeField"];
    const defaultOrderResult = findDenyListViolations(names);
    const shuffledOrderResult = findDenyListViolations(names, shuffled);
    expect(shuffledOrderResult).toEqual(defaultOrderResult);
  });

  it("returns an empty list for an empty input and does not throw", () => {
    expect(() => findDenyListViolations([])).not.toThrow();
    expect(findDenyListViolations([])).toEqual([]);
  });

  it("does not report an ordinary, unrelated field name", () => {
    expect(findDenyListViolations(["categoryCode", "quantity", "unitRate"])).toEqual([]);
  });
});
