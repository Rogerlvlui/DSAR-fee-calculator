// packages/schemas/src/assessment.property.test.ts
//
// SCHEMA-07: a 10,000-run fast-check property over generated Assessment
// values, asserting Number.isInteger() over every money field of the
// parsed result. This harness runs over hand-constructed Assessment values
// via assessmentArb (packages/schemas/src/__fixtures__/arbitraries.ts) and
// stays that way deliberately — re-pointing THIS file at assess() output
// would give packages/schemas a dependency on packages/engine, inverting
// the package graph the whole architecture rests on (packages/engine is
// the downstream consumer of the freeze, never the other way round).
//
// Plan 02-07 satisfies the same intent from the correct side of that
// boundary: packages/engine/src/assess.property.test.ts reuses
// expenseLineArb/minimalRulePackArb from this package's own arbitraries.ts
// (the same file this test imports assessmentArb from) and asserts the
// equivalent integer/totals invariants over REAL assess() output, with the
// same RECORDED_SEED so a counterexample from either file is replayable.
//
// RECORDED_SEED makes a counterexample replayable: if this test ever
// fails, re-running with the same seed reproduces the exact failing case
// rather than leaving it a one-off, unreproducible observation.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { AssessmentSchema, type Assessment } from "./assessment.ts";
import { assessmentArb } from "./__fixtures__/arbitraries.ts";

const RECORDED_SEED = 20260915;
const NUM_RUNS = 10_000;

function moneyFieldsOf(parsed: Assessment): number[] {
  const totals = parsed.totals;
  const totalsFields: number[] = [
    totals.claimedTotal,
    totals.draftBaseline,
    totals.disallowedTotal,
    totals.flaggedTotal,
    totals.restingOnUnverifiedRules,
    ...(totals.finalAmount === null ? [] : [totals.finalAmount]),
  ];
  const lineFields: number[] = parsed.lines.flatMap((line) => [
    line.engineAmount,
    ...(line.lawyerAmount === null ? [] : [line.lawyerAmount]),
  ]);
  return [...totalsFields, ...lineFields];
}

describe("Assessment money-integer property (SCHEMA-07)", () => {
  it(`holds Number.isInteger() over every money field across ${NUM_RUNS} generated cases (seed ${RECORDED_SEED})`, () => {
    fc.assert(
      fc.property(assessmentArb, (raw) => {
        const parsed = AssessmentSchema.parse(raw);
        for (const value of moneyFieldsOf(parsed)) {
          expect(Number.isInteger(value)).toBe(true);
          expect(Number.isNaN(value)).toBe(false);
        }
      }),
      { numRuns: NUM_RUNS, seed: RECORDED_SEED }
    );
  });

  it("a zero-line Assessment yields every Totals money field at 0 and finalAmount at null — never NaN or undefined", () => {
    const parsed = AssessmentSchema.parse({
      id: "assessment-empty",
      matterId: "matter-empty",
      rulePackId: "SG-PDPA",
      rulePackVersion: "2026.09.1",
      engineVersion: "0.1.0",
      computedAt: "2026-09-15T00:00:00Z",
      lines: [],
      matterLevelFlags: [],
      totals: {
        claimedTotal: 0,
        draftBaseline: 0,
        disallowedTotal: 0,
        flaggedTotal: 0,
        restingOnUnverifiedRules: 0,
        finalAmount: null,
      },
      signOff: null,
    });

    expect(parsed.lines).toHaveLength(0);
    expect(parsed.totals.finalAmount).toBeNull();
    for (const value of [
      parsed.totals.claimedTotal,
      parsed.totals.draftBaseline,
      parsed.totals.disallowedTotal,
      parsed.totals.flaggedTotal,
      parsed.totals.restingOnUnverifiedRules,
    ]) {
      expect(value).toBe(0);
      expect(value).not.toBeUndefined();
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  it("a line whose claimed amount exactly equals its cap amount still yields integer money fields", () => {
    const parsed = AssessmentSchema.parse({
      id: "assessment-cap-boundary",
      matterId: "matter-1",
      rulePackId: "HK-PDPO",
      rulePackVersion: "2026.09.1",
      engineVersion: "0.1.0",
      computedAt: "2026-09-15T00:00:00Z",
      lines: [
        {
          id: "line-cap-boundary",
          expenseLineId: "expense-1",
          verdict: "ALLOW_CAPPED",
          // Deliberately equal to appliedCap.amount below — the adjacency
          // edge this test exists to cover.
          engineAmount: 2640,
          appliedRuleId: "HK-PDPO.PHOTOCOPY_PRINT",
          appliedCap: { type: "PER_LINE", amount: 2640 },
          basis: "Photocopy cap applied; claim equals the cap exactly.",
          citation: { instrument: "PDPO", provision: "s.28(2)" },
          flagReasons: [],
          disposition: "PENDING",
          lawyerAmount: null,
          lawyerReason: null,
          dispositionedBy: null,
          dispositionedAt: null,
        },
      ],
      matterLevelFlags: [],
      totals: {
        claimedTotal: 2640,
        draftBaseline: 2640,
        disallowedTotal: 0,
        flaggedTotal: 0,
        restingOnUnverifiedRules: 0,
        finalAmount: null,
      },
      signOff: null,
    });

    expect(parsed.lines[0]?.engineAmount).toBe(2640);
    for (const value of moneyFieldsOf(parsed)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});
