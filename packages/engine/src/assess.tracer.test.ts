// packages/engine/src/assess.tracer.test.ts
//
// Task 1's tracer: one ALLOW-treatment expense line traveling through every
// layer assess() will ever have — preconditions, per-line evaluation,
// totals, Assessment assembly — proven schema-valid via
// AssessmentSchema.parse() rather than trusted from the TypeScript return
// type (02-CONTEXT.md: "an architectural mistake in the Assessment
// construction surfaces after one commit rather than after six").
//
// Plan 02-05 update: §8.1 step 4's materiality check flags any line at 40%
// or more of claimedTotal — and a genuinely single-line matter's one line is
// definitionally 100% of its own total, so it is now correctly flagged
// MATERIALITY the moment step 4 is wired in (ENGINE-06). That is correct
// engine behaviour, not a regression, but it defeats this tracer's original
// "one ALLOW line, nothing else in play" framing. Two same-category
// DILUTION_LINE fixtures are added below purely so REFERENCE_LINE's own
// share stays under 40% and its ALLOW-path mechanics remain the thing under
// test — a two-line split cannot get any line under 40% (the smaller share
// of a two-way split is always >=50%), so three equal-sized lines are used.

import { describe, expect, it } from "vitest";
import { AssessmentSchema } from "@dsar/schemas/assessment";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { assess } from "./assess.ts";
import {
  buildReferencePack,
  REFERENCE_LINE,
  REFERENCE_MATTER,
  REFERENCE_NOW,
} from "./__fixtures__/reference-matter.ts";

// Same category as REFERENCE_LINE (STAFF_TIME_SEARCH) so buildReferencePack's
// single CategoryRule applies to all three lines unmodified. Same
// claimedAmount as REFERENCE_LINE (16000) so each of the three lines is
// exactly 1/3 (33.3%) of the 48000 claimedTotal — under the 40% threshold —
// and distinct descriptions so the duplicate check has nothing to fire on.
function dilutionLine(id: string, description: string): ExpenseLine {
  return ExpenseLineSchema.parse({
    id,
    matterId: REFERENCE_MATTER.id,
    seq: 1,
    categoryCode: "STAFF_TIME_SEARCH",
    description,
    quantity: 4,
    unit: "HOUR",
    unitRate: 4000,
    claimedAmount: 16000,
    incurredByGrade: "EXECUTIVE",
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  });
}

const DILUTION_LINE_A = dilutionLine("dilution-line-a", "Additional staff time locating a second record set");
const DILUTION_LINE_B = dilutionLine("dilution-line-b", "Additional staff time locating a third record set");

describe("assess() — Task 1 tracer: one ALLOW line end to end", () => {
  it("returns a schema-valid Assessment for a single ALLOW line", () => {
    const pack = buildReferencePack();
    const result = assess({
      matter: REFERENCE_MATTER,
      lines: [REFERENCE_LINE, DILUTION_LINE_A, DILUTION_LINE_B],
      pack,
      now: REFERENCE_NOW,
    });

    expect(() => AssessmentSchema.parse(result)).not.toThrow();

    expect(result.lines).toHaveLength(3);
    const [line] = result.lines;
    expect(line?.verdict).toBe("ALLOW");
    expect(line?.engineAmount).toBe(16000);
    expect(line?.flagReasons).toEqual([]);
    expect(line?.disposition).toBe("PENDING");
    expect(line?.appliedRuleId).toBe(pack.categoryRules[0]?.ruleId);
    expect(line?.basis).toBe(pack.categoryRules[0]?.basis);
    expect(line?.citation).toEqual(pack.categoryRules[0]?.citation);

    expect(result.totals).toEqual({
      claimedTotal: 48000,
      draftBaseline: 48000,
      disallowedTotal: 0,
      flaggedTotal: 0,
      restingOnUnverifiedRules: 0,
      finalAmount: null,
    });
  });

  it("moves the line's amount into restingOnUnverifiedRules — a subset of draftBaseline, not an addition — when the applied rule is NEEDS_VERIFICATION", () => {
    const pack = buildReferencePack({ categoryRule: { verificationStatus: "NEEDS_VERIFICATION" } });
    const result = assess({
      matter: REFERENCE_MATTER,
      lines: [REFERENCE_LINE, DILUTION_LINE_A, DILUTION_LINE_B],
      pack,
      now: REFERENCE_NOW,
    });

    // All three lines share the one CategoryRule, so all three (48000) are
    // NEEDS_VERIFICATION — restingOnUnverifiedRules equals draftBaseline
    // here, not just REFERENCE_LINE's own 16000.
    expect(result.totals.draftBaseline).toBe(48000);
    expect(result.totals.restingOnUnverifiedRules).toBe(48000);
  });

  it("is deterministic — identical input produces deeply equal output", () => {
    const pack = buildReferencePack();
    const lines = [REFERENCE_LINE, DILUTION_LINE_A, DILUTION_LINE_B];
    const first = assess({ matter: REFERENCE_MATTER, lines, pack, now: REFERENCE_NOW });
    const second = assess({ matter: REFERENCE_MATTER, lines, pack, now: REFERENCE_NOW });
    expect(first).toEqual(second);
  });
});
