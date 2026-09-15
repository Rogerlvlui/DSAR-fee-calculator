// packages/engine/src/aggregate-cap.test.ts
//
// PRD §8.1 step 5 / D-11 / ENGINE-07 — the pure pro-rata allocator
// (applyAggregateCap) and the higher-level step function
// (applyAggregateCapStep) that maps it over a matter's AssessmentLine[].
// Every expected value below is literal, never a derived/computed
// expectation — PROJECT.md rejected both a largest-remainder and a
// by-sequence allocation scheme specifically because they hit the cap
// exactly, so an allocation test asserting only the residue (not each
// line's own share) would not catch a regression back to either.

import { describe, expect, it } from "vitest";
import { AssessmentLineSchema, type AssessmentLine } from "@dsar/schemas/assessment";
import type { Cap } from "@dsar/schemas/rule-pack";
import type { Minor } from "@dsar/schemas/primitives";
import { applyAggregateCap, applyAggregateCapStep } from "./aggregate-cap.ts";
import { EngineComputationFailure } from "./errors.ts";
import { buildAggregateCapFixturePack } from "./__fixtures__/aggregate-cap-pack.ts";

function minor(n: number): Minor {
  return n as Minor;
}

describe("applyAggregateCap — pure pro-rata allocator", () => {
  it("three lines of 100 against a binding cap of 250 become 83, 83, 83 with a residue of 1", () => {
    const result = applyAggregateCap(minor(250), [minor(100), minor(100), minor(100)]);
    expect(result).toEqual({ allocated: [83, 83, 83], residue: 1, bound: true });
  });

  it("the same three lines against a cap of 400 (non-binding) are unchanged, with no residue reported", () => {
    const result = applyAggregateCap(minor(400), [minor(100), minor(100), minor(100)]);
    expect(result).toEqual({ allocated: [100, 100, 100], residue: 0, bound: false });
  });

  it("a cap exactly equal to the sum leaves every line unchanged and produces no residue", () => {
    const result = applyAggregateCap(minor(300), [minor(100), minor(100), minor(100)]);
    expect(result).toEqual({ allocated: [100, 100, 100], residue: 0, bound: false });
  });

  it("a single allowed line against a binding cap comes out at the cap value exactly", () => {
    const result = applyAggregateCap(minor(100), [minor(150)]);
    expect(result).toEqual({ allocated: [100], residue: 0, bound: true });
  });

  it("three lines of 100 against a cap of 1 produce three zeros and a residue of 1, no division by zero", () => {
    const result = applyAggregateCap(minor(1), [minor(100), minor(100), minor(100)]);
    expect(result).toEqual({ allocated: [0, 0, 0], residue: 1, bound: true });
  });

  it("zero allowed lines performs no division and produces no residue", () => {
    const result = applyAggregateCap(minor(250), []);
    expect(result).toEqual({ allocated: [], residue: 0, bound: false });
  });

  it("a cap below the smallest line still allocates pro-rata across all lines", () => {
    // 50 and 200 against a cap of 10: floor(10*50/250)=2, floor(10*200/250)=8.
    const result = applyAggregateCap(minor(10), [minor(50), minor(200)]);
    expect(result).toEqual({ allocated: [2, 8], residue: 0, bound: true });
  });
});

function allowLine(overrides: Partial<AssessmentLine> = {}): AssessmentLine {
  return {
    id: "line-1",
    expenseLineId: "expense-1",
    verdict: "ALLOW",
    engineAmount: minor(100),
    appliedRuleId: "RULE.TEST",
    appliedCap: null,
    basis: "Test rule basis.",
    citation: { instrument: "TEST", provision: "s.1" },
    flagReasons: [],
    disposition: "PENDING",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  };
}

describe("applyAggregateCapStep — mapping the allocation onto AssessmentLine[]", () => {
  it("reduces every ALLOW/ALLOW_CAPPED line pro-rata, keeps ALLOW_CAPPED verdict, sets appliedCap, raises the matter flag", () => {
    const pack = buildAggregateCapFixturePack({ aggregateCap: { type: "PER_MATTER", amount: minor(250) } });
    const lines: AssessmentLine[] = [
      allowLine({ id: "l1", expenseLineId: "e1", engineAmount: minor(100) }),
      allowLine({ id: "l2", expenseLineId: "e2", engineAmount: minor(100), verdict: "ALLOW_CAPPED" }),
      allowLine({ id: "l3", expenseLineId: "e3", engineAmount: minor(100) }),
    ];

    const result = applyAggregateCapStep({ lines, pack, claimedTotal: minor(300) });

    expect(result.lines.map((l) => ({ verdict: l.verdict, engineAmount: l.engineAmount }))).toEqual([
      { verdict: "ALLOW_CAPPED", engineAmount: 83 },
      { verdict: "ALLOW_CAPPED", engineAmount: 83 },
      { verdict: "ALLOW_CAPPED", engineAmount: 83 },
    ]);
    for (const line of result.lines) {
      expect(line.appliedCap).toEqual({ type: "PER_MATTER", amount: 250 });
      expect(line.flagReasons).toEqual([]);
      expect(() => AssessmentLineSchema.parse(line)).not.toThrow();
    }
    expect(result.matterFlag).toEqual({
      id: "AGGREGATE_CAP_APPLIED",
      code: "AGGREGATE_CAP_APPLIED",
      message: expect.any(String),
      requiresAcknowledgement: true,
    });
  });

  it("a non-binding cap changes nothing and raises no matter flag", () => {
    const pack = buildAggregateCapFixturePack({ aggregateCap: { type: "PER_MATTER", amount: minor(400) } });
    const lines: AssessmentLine[] = [
      allowLine({ id: "l1", expenseLineId: "e1", engineAmount: minor(100) }),
      allowLine({ id: "l2", expenseLineId: "e2", engineAmount: minor(100) }),
    ];

    const result = applyAggregateCapStep({ lines, pack, claimedTotal: minor(200) });

    expect(result.lines).toEqual(lines);
    expect(result.matterFlag).toBeNull();
  });

  it("no aggregate cap in the pack (null) changes nothing and raises no matter flag", () => {
    const pack = buildAggregateCapFixturePack({ aggregateCap: null });
    const lines: AssessmentLine[] = [allowLine({ id: "l1", expenseLineId: "e1", engineAmount: minor(100) })];

    const result = applyAggregateCapStep({ lines, pack, claimedTotal: minor(100) });

    expect(result.lines).toEqual(lines);
    expect(result.matterFlag).toBeNull();
  });

  it("DISALLOW and FLAG lines are untouched and never consume cap headroom", () => {
    const pack = buildAggregateCapFixturePack({ aggregateCap: { type: "PER_MATTER", amount: minor(1) } });
    const disallowLine = allowLine({
      id: "l-disallow",
      expenseLineId: "e-disallow",
      verdict: "DISALLOW",
      engineAmount: minor(0),
    });
    const flagLine = allowLine({
      id: "l-flag",
      expenseLineId: "e-flag",
      verdict: "FLAG",
      engineAmount: minor(0),
      flagReasons: [{ code: "UNCATEGORISED", message: "test" }],
    });
    const lines: AssessmentLine[] = [disallowLine, flagLine];

    const result = applyAggregateCapStep({ lines, pack, claimedTotal: minor(0) });

    // No ALLOW/ALLOW_CAPPED lines exist, so the allocator sees a zero sum
    // and the cap never binds — DISALLOW/FLAG lines are returned unchanged.
    expect(result.lines).toEqual(lines);
    expect(result.matterFlag).toBeNull();
  });

  it("a PERCENT_OF_CLAIM aggregate cap resolves the cap amount by flooring against claimedTotal before allocating", () => {
    // 25% of claimedTotal 1000 = 250 — same binding scenario as the
    // PER_MATTER 250 case above, reached via a different cap shape.
    const pack = buildAggregateCapFixturePack({ aggregateCap: { type: "PERCENT_OF_CLAIM", percent: 25 } });
    const lines: AssessmentLine[] = [
      allowLine({ id: "l1", expenseLineId: "e1", engineAmount: minor(100) }),
      allowLine({ id: "l2", expenseLineId: "e2", engineAmount: minor(100) }),
      allowLine({ id: "l3", expenseLineId: "e3", engineAmount: minor(100) }),
    ];

    const result = applyAggregateCapStep({ lines, pack, claimedTotal: minor(1000) });

    expect(result.lines.map((l) => l.engineAmount)).toEqual([83, 83, 83]);
    expect(result.matterFlag).not.toBeNull();
  });

  it("a PER_UNIT aggregate cap type raises a typed EngineComputationFailure naming the cap type", () => {
    const invalidCap: Cap = { type: "PER_UNIT", amount: minor(10), unit: "PAGE" };
    const pack = buildAggregateCapFixturePack({ aggregateCap: invalidCap });
    const lines: AssessmentLine[] = [allowLine({ id: "l1", expenseLineId: "e1", engineAmount: minor(100) })];

    expect(() => applyAggregateCapStep({ lines, pack, claimedTotal: minor(100) })).toThrow(EngineComputationFailure);

    try {
      applyAggregateCapStep({ lines, pack, claimedTotal: minor(100) });
      expect.unreachable("applyAggregateCapStep must throw for a PER_UNIT aggregateCap");
    } catch (error) {
      expect(error).toBeInstanceOf(EngineComputationFailure);
      expect((error as EngineComputationFailure).code).toBe("AGGREGATE_CAP_INVALID_TYPE");
      expect((error as EngineComputationFailure).detail).toEqual({ capType: "PER_UNIT" });
    }
  });

  it("a PER_LINE aggregate cap type also raises a typed EngineComputationFailure", () => {
    const invalidCap: Cap = { type: "PER_LINE", amount: minor(10) };
    const pack = buildAggregateCapFixturePack({ aggregateCap: invalidCap });
    const lines: AssessmentLine[] = [allowLine({ id: "l1", expenseLineId: "e1", engineAmount: minor(100) })];

    expect(() => applyAggregateCapStep({ lines, pack, claimedTotal: minor(100) })).toThrow(EngineComputationFailure);
  });
});
