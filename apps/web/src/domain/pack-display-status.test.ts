// apps/web/src/domain/pack-display-status.test.ts
//
// Moved from apps/web/src/ui/intake/matter-details-fields.test.tsx alongside
// the relocation of humanizePackDisplayStatus (see pack-display-status.ts's
// own header note). Tagged PACK-DISPLAY-STATUS.
//
// 05-REVIEW-ADDENDUM.md WR-02: intake-form.tsx, matters/[id]/page.tsx and
// matters/[id]/submitted/page.tsx all passed the raw displayStatus enum
// straight into StatusStrip's packStatus prop, which renders it as plain
// text — so HR would eventually see a literal underscored string like
// "ACTIVE_REVIEW_DUE_SOON" once any pack left DRAFT. humanizePackDisplayStatus
// is the shared fix all three call sites now route through.

import { describe, expect, it } from "vitest";
import { humanizePackDisplayStatus, type MatterDetailsJurisdictionPackDisplayStatus } from "./pack-display-status.ts";

describe("PACK-DISPLAY-STATUS: humanizePackDisplayStatus — no raw underscored enum value ever reaches StatusStrip", () => {
  const ALL_DISPLAY_STATUSES: MatterDetailsJurisdictionPackDisplayStatus[] = [
    "ACTIVE",
    "ACTIVE_REVIEW_DUE_SOON",
    "STALE",
    "DRAFT",
    "NO_USABLE_PACK",
  ];

  it.each(ALL_DISPLAY_STATUSES)(
    "PACK-DISPLAY-STATUS: humanizePackDisplayStatus(%s) contains no underscore",
    (displayStatus) => {
      expect(humanizePackDisplayStatus(displayStatus)).not.toMatch(/_/);
    }
  );

  it("PACK-DISPLAY-STATUS: humanizePackDisplayStatus resolves NO_USABLE_PACK to the same placeholder every call site already used", () => {
    expect(humanizePackDisplayStatus("NO_USABLE_PACK")).toBe("—");
  });

  it("PACK-DISPLAY-STATUS: humanizePackDisplayStatus gives ACTIVE_REVIEW_DUE_SOON a short, human label", () => {
    expect(humanizePackDisplayStatus("ACTIVE_REVIEW_DUE_SOON")).toBe("Active — review due soon");
  });
});
