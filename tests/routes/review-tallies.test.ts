// tests/routes/review-tallies.test.ts
//
// Pure unit tests for apps/web/src/domain/review-tallies.ts, tagged
// TALLIES. Lives under tests/routes/ per the plan's own instruction (it
// exercises a domain module, and presentational tests stay colocated with
// their components).

import { describe, expect, it } from "vitest";
import { AssessmentLineSchema, type AssessmentLine } from "@dsar/schemas/assessment";
import { computeFinalAmount, computeReviewTallies } from "../../apps/web/src/domain/review-tallies.ts";

function line(overrides: Record<string, unknown>): AssessmentLine {
  return AssessmentLineSchema.parse({
    id: "line-1",
    expenseLineId: "expense-1",
    verdict: "ALLOW",
    engineAmount: 1000,
    appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
    appliedCap: null,
    basis: "Test basis.",
    citation: { instrument: "Test instrument", provision: "s.1" },
    flagReasons: [],
    disposition: "PENDING",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  });
}

describe("TALLIES", () => {
  it("TALLIES: counts accepted, reduced, struck and lawyer-allowed lines, and sums final amount across a mixed set", () => {
    const lines = [
      line({ id: "l1", disposition: "ACCEPTED", engineAmount: 16000 }),
      line({ id: "l2", disposition: "REDUCED", engineAmount: 3300, lawyerAmount: 2640 }),
      line({ id: "l3", disposition: "STRUCK", engineAmount: 0 }),
      line({ id: "l4", verdict: "DISALLOW", disposition: "ALLOWED_BY_LAWYER", engineAmount: 0, lawyerAmount: 12000 }),
    ];

    const tallies = computeReviewTallies(lines);
    expect(tallies.accepted).toBe(1);
    expect(tallies.reduced).toBe(1);
    expect(tallies.struck).toBe(1);
    expect(tallies.lawyerAllowed).toBe(1);
    expect(tallies.lawyerAllowedAmount).toBe(12000);

    // engine amount (accepted) + lawyer amount (reduced) + 0 (struck) +
    // lawyer amount (allowed-by-lawyer) = 16000 + 2640 + 0 + 12000
    expect(computeFinalAmount(lines)).toBe(30640);
  });

  it("TALLIES: refuses to produce a final amount while any line is still PENDING", () => {
    const lines = [line({ id: "l1", disposition: "ACCEPTED" }), line({ id: "l2", disposition: "PENDING" })];
    expect(() => computeFinalAmount(lines)).toThrow(/PENDING/);
  });
});
