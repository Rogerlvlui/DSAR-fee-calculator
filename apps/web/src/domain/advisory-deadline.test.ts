// apps/web/src/domain/advisory-deadline.test.ts
//
// Tagged ADVISORY-DEADLINE. The regression test asserts against the exact
// fixture values apps/web/src/server/review-view.ts's pre-existing behavior
// already produced — a pure relocation, no behavior change.

import { describe, expect, it } from "vitest";
import type { Matter } from "@dsar/schemas/matter";
import { addDaysToIsoDate, computeAdvisoryDeadline, ADVISORY_QUALIFIER } from "./advisory-deadline.ts";

function matter(overrides: Partial<Matter> = {}): Matter {
  return {
    requestReceivedOn: "2026-08-20",
    ...overrides,
  } as Matter;
}

describe("ADVISORY-DEADLINE: computeAdvisoryDeadline", () => {
  it("ADVISORY-DEADLINE: returns null when both feeNotificationDeadlineDays and responseDeadlineDays are null", () => {
    const result = computeAdvisoryDeadline(
      matter(),
      { feeNotificationDeadlineDays: null, responseDeadlineDays: null },
      "2026-08-25T00:00:00.000Z"
    );
    expect(result).toBeNull();
  });

  it("ADVISORY-DEADLINE: prefers FEE_NOTIFICATION basis when the pack sets a fee-notification deadline, even if a response deadline also exists", () => {
    const result = computeAdvisoryDeadline(
      matter(),
      { feeNotificationDeadlineDays: 14, responseDeadlineDays: 30 },
      "2026-08-25T00:00:00.000Z"
    );
    expect(result?.basis).toBe("FEE_NOTIFICATION");
  });

  it("ADVISORY-DEADLINE: falls back to RESPONSE_DEADLINE_FALLBACK basis when only a response deadline exists (the real SG pack's own shape)", () => {
    const result = computeAdvisoryDeadline(
      matter(),
      { feeNotificationDeadlineDays: null, responseDeadlineDays: 30 },
      "2026-08-25T00:00:00.000Z"
    );
    expect(result?.basis).toBe("RESPONSE_DEADLINE_FALLBACK");
  });

  it("ADVISORY-DEADLINE: the exact same inputs review-view.ts's pre-existing tests used produce byte-identical output after the extraction", () => {
    const result = computeAdvisoryDeadline(
      matter({ requestReceivedOn: "2026-08-20" }),
      { feeNotificationDeadlineDays: null, responseDeadlineDays: 30 },
      "2026-08-25T00:00:00.000Z"
    );
    expect(result).toEqual({
      basis: "RESPONSE_DEADLINE_FALLBACK",
      dueDateIso: "2026-09-19",
      daysRemaining: 25,
    });
  });
});

describe("ADVISORY-DEADLINE: addDaysToIsoDate", () => {
  it("ADVISORY-DEADLINE: is calendar-correct across a month boundary", () => {
    expect(addDaysToIsoDate("2026-01-28", 5)).toBe("2026-02-02");
  });
});

describe("ADVISORY-DEADLINE: ADVISORY_QUALIFIER", () => {
  it("ADVISORY-DEADLINE: is exported and equals the string matter-rail.tsx used to declare locally", () => {
    expect(ADVISORY_QUALIFIER).toBe("Advisory only. This tool is not the deadline system of record.");
  });
});
