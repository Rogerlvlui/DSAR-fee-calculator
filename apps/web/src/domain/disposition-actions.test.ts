// apps/web/src/domain/disposition-actions.test.ts
//
// AC-23's stop-list half: matchesReasonStopList and
// hasSufficientAndGenuineReason. Colocated, pure-function tests — no
// rendering needed.

import { describe, expect, it } from "vitest";
import { hasSufficientAndGenuineReason, matchesReasonStopList } from "./disposition-actions.ts";

describe("disposition-actions: matchesReasonStopList", () => {
  it("disposition-actions: matches a reason that is, after trimming, exactly a stop-list entry (case-insensitive)", () => {
    expect(matchesReasonStopList("noted")).toBe("noted");
    expect(matchesReasonStopList("  Noted  ")).toBe("noted");
    expect(matchesReasonStopList("AS ABOVE")).toBe("as above");
  });

  it("disposition-actions: does NOT match a genuine sentence that merely contains a stop-list word as a substring", () => {
    expect(matchesReasonStopList("Noted the vendor's invoice number and it matches the claim")).toBeNull();
    expect(matchesReasonStopList("same as line 3, see attached")).toBeNull();
  });

  it("disposition-actions: returns null for a reason that matches no stop-list entry at all", () => {
    expect(matchesReasonStopList("Sighted the supporting evidence separately and it checks out.")).toBeNull();
  });
});

describe("disposition-actions: hasSufficientAndGenuineReason", () => {
  it("disposition-actions: the PRD's own example — 'noted' (10 characters, clears length alone) — fails the combined check", () => {
    expect(hasSufficientAndGenuineReason("noted")).toBe(false);
  });

  it("disposition-actions: a genuine, sufficiently long, non-stock-phrase reason passes", () => {
    expect(hasSufficientAndGenuineReason("Sighted the supporting evidence separately and it checks out.")).toBe(true);
  });

  it("disposition-actions: a reason that is long enough but is exactly a stop-list phrase (e.g. 'as above') still fails", () => {
    expect(hasSufficientAndGenuineReason("as above")).toBe(false);
  });

  it("disposition-actions: a genuine sentence that happens to contain a stop-list word as a substring still passes", () => {
    expect(hasSufficientAndGenuineReason("Noted the vendor's invoice number and it matches the claim")).toBe(true);
  });
});
