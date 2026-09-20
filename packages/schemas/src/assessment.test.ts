// packages/schemas/src/assessment.test.ts
//
// Falsifies AssessmentSchema and its component schemas: Verdict/Disposition
// cardinality, the flagReasons/FLAG cross-field refinement (both
// directions), Totals.finalAmount's null-no-default property (AC-25), and
// the lawyerReason cap read from FREE_TEXT_LIMITS.

import { describe, expect, it } from "vitest";
import {
  AssessmentLineSchema,
  AssessmentSchema,
  DispositionSchema,
  TotalsSchema,
  VerdictSchema,
} from "./assessment.ts";
import { FREE_TEXT_LIMITS } from "./constants.ts";
import { MINOR_MAX } from "./primitives.ts";

function validLine(overrides: Record<string, unknown> = {}) {
  return {
    id: "line-1",
    expenseLineId: "expense-1",
    verdict: "ALLOW",
    engineAmount: 16000,
    appliedRuleId: "SG-PDPA.STAFF_TIME_SEARCH",
    appliedCap: null,
    basis: "Direct labour cost of locating the requested data.",
    citation: { instrument: "PDPA", provision: "s.10" },
    flagReasons: [],
    disposition: "PENDING",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  };
}

function validTotals(overrides: Record<string, unknown> = {}) {
  return {
    claimedTotal: 88800,
    draftBaseline: 26640,
    disallowedTotal: 12660,
    flaggedTotal: 49500,
    restingOnUnverifiedRules: 10640,
    finalAmount: null,
    ...overrides,
  };
}

function validAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: "assessment-1",
    matterId: "matter-1",
    rulePackId: "SG-PDPA",
    rulePackVersion: "2026.09.1",
    engineVersion: "0.1.0",
    computedAt: "2026-09-15T00:00:00Z",
    lines: [validLine()],
    matterLevelFlags: [],
    totals: validTotals(),
    signOff: null,
    ...overrides,
  };
}

describe("VerdictSchema / DispositionSchema cardinality", () => {
  it("Verdict has exactly 4 members", () => {
    expect(VerdictSchema.options.length).toBe(4);
  });

  it("Disposition has exactly 5 members", () => {
    expect(DispositionSchema.options.length).toBe(5);
  });
});

describe("AssessmentSchema — full parse", () => {
  it("parses a fully-populated Assessment, with Totals.finalAmount null", () => {
    const result = AssessmentSchema.safeParse(validAssessment());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totals.finalAmount).toBeNull();
    }
  });
});

describe("AssessmentSchema — feeChoice (06-07, additive)", () => {
  it("parses an Assessment with no feeChoice key at all — backward compatibility with every existing committed/fixture Assessment", () => {
    const result = AssessmentSchema.safeParse(validAssessment());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feeChoice).toBeUndefined();
    }
  });

  it("accepts feeChoice: 'ITEMISED' and feeChoice: 'FLAT'", () => {
    expect(AssessmentSchema.safeParse(validAssessment({ feeChoice: "ITEMISED" })).success).toBe(true);
    expect(AssessmentSchema.safeParse(validAssessment({ feeChoice: "FLAT" })).success).toBe(true);
  });

  it("rejects any other feeChoice string", () => {
    expect(AssessmentSchema.safeParse(validAssessment({ feeChoice: "BOTH" })).success).toBe(false);
  });
});

describe("TotalsSchema — the six §8.1 step 6 fields", () => {
  // D-12 adds a seventh, OPTIONAL declared field (flatFeeComparison) to the
  // schema's shape. This exact-equality assertion is updated to include it —
  // the six original §8.1 step 6 fields are unchanged and un-retyped, and
  // the additive-only freeze (D-09) permits exactly this kind of extension.
  // The behavioral guarantee that matters — a Totals object with only the
  // six original keys still parses, with no comparison property on the
  // result — is covered separately below ("TotalsSchema — flatFeeComparison
  // (D-12)").
  it("declares the six original fields plus the D-12 optional flatFeeComparison extension", () => {
    const shape = (TotalsSchema as unknown as { shape: Record<string, unknown> }).shape;
    expect(Object.keys(shape).sort()).toEqual(
      [
        "claimedTotal",
        "draftBaseline",
        "disallowedTotal",
        "flaggedTotal",
        "restingOnUnverifiedRules",
        "finalAmount",
        "flatFeeComparison",
      ].sort()
    );
  });
});

describe("TotalsSchema — finalAmount (AC-25)", () => {
  it("finalAmount is required with no default — omitting it fails rather than populating from draftBaseline", () => {
    const { finalAmount: _drop, ...withoutFinalAmount } = validTotals();
    void _drop;
    const result = TotalsSchema.safeParse(withoutFinalAmount);
    expect(result.success).toBe(false);
  });

  it("finalAmount null parses and is never coerced to a number", () => {
    const result = TotalsSchema.safeParse(validTotals({ finalAmount: null }));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.finalAmount).toBeNull();
    }
  });
});

describe("AssessmentLineSchema — flagReasons/FLAG cross-field refinement", () => {
  it("a FLAG line with empty flagReasons fails", () => {
    const result = AssessmentLineSchema.safeParse(
      validLine({ verdict: "FLAG", engineAmount: 0, flagReasons: [] })
    );
    expect(result.success).toBe(false);
  });

  it("an ALLOW line with non-empty flagReasons fails", () => {
    const result = AssessmentLineSchema.safeParse(
      validLine({
        verdict: "ALLOW",
        flagReasons: [{ code: "MATERIALITY", message: "Line is 50% of claim." }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("a FLAG line with non-empty flagReasons parses", () => {
    const result = AssessmentLineSchema.safeParse(
      validLine({
        verdict: "FLAG",
        engineAmount: 0,
        flagReasons: [{ code: "UNCATEGORISED", message: "Line is unclassified." }],
      })
    );
    expect(result.success).toBe(true);
  });
});

// D-12: an additive, optional flat-fee comparison block on TotalsSchema,
// carrying the pack's flat figure, the itemised direct cost (= draftBaseline,
// per D-12's definition), and whether the flat figure exceeds it. Optional,
// not nullable-required, so a pack with no flat fee omits the key entirely —
// every existing six-key Totals assertion above keeps passing unmodified.
describe("TotalsSchema — flatFeeComparison (D-12)", () => {
  it("a Totals object with the six existing keys and no comparison key parses, with no comparison property on the result", () => {
    const result = TotalsSchema.safeParse(validTotals());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.prototype.hasOwnProperty.call(result.data, "flatFeeComparison")).toBe(false);
    }
  });

  it("a Totals object carrying the comparison block parses, with the flat amount branded and the boolean present", () => {
    const result = TotalsSchema.safeParse(
      validTotals({
        flatFeeComparison: {
          flatFeeAmount: 50000,
          itemisedDirectCostAmount: 26640,
          flatFeeExceedsItemisedCost: true,
        },
      })
    );
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.flatFeeComparison?.flatFeeAmount).toBe(50000);
      expect(result.data.flatFeeComparison?.flatFeeExceedsItemisedCost).toBe(true);
    }
  });

  it("rejects a comparison block whose flat amount is a non-integer", () => {
    const result = TotalsSchema.safeParse(
      validTotals({
        flatFeeComparison: {
          flatFeeAmount: 500.5,
          itemisedDirectCostAmount: 26640,
          flatFeeExceedsItemisedCost: true,
        },
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a comparison block whose flat amount is outside the Minor bounds", () => {
    const result = TotalsSchema.safeParse(
      validTotals({
        flatFeeComparison: {
          flatFeeAmount: MINOR_MAX + 1,
          itemisedDirectCostAmount: 26640,
          flatFeeExceedsItemisedCost: true,
        },
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a comparison block missing the boolean", () => {
    const result = TotalsSchema.safeParse(
      validTotals({
        flatFeeComparison: {
          flatFeeAmount: 50000,
          itemisedDirectCostAmount: 26640,
        },
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a comparison block carrying an undeclared extra key", () => {
    const result = TotalsSchema.safeParse(
      validTotals({
        flatFeeComparison: {
          flatFeeAmount: 50000,
          itemisedDirectCostAmount: 26640,
          flatFeeExceedsItemisedCost: true,
          currency: "SGD",
        },
      })
    );
    expect(result.success).toBe(false);
  });

  it("still rejects a missing finalAmount key (AC-25 unaffected)", () => {
    const { finalAmount: _drop, ...withoutFinalAmount } = validTotals();
    void _drop;
    const result = TotalsSchema.safeParse(withoutFinalAmount);
    expect(result.success).toBe(false);
  });

  it("still accepts finalAmount: null (AC-25 unaffected)", () => {
    const result = TotalsSchema.safeParse(validTotals({ finalAmount: null }));
    expect(result.success).toBe(true);
  });
});

describe("AssessmentLineSchema — lawyerReason cap read from FREE_TEXT_LIMITS", () => {
  it(`accepts ${FREE_TEXT_LIMITS.lawyerReason} characters`, () => {
    const result = AssessmentLineSchema.safeParse(
      validLine({ lawyerReason: "x".repeat(FREE_TEXT_LIMITS.lawyerReason) })
    );
    expect(result.success).toBe(true);
  });

  it(`rejects ${FREE_TEXT_LIMITS.lawyerReason + 1} characters`, () => {
    const result = AssessmentLineSchema.safeParse(
      validLine({ lawyerReason: "x".repeat(FREE_TEXT_LIMITS.lawyerReason + 1) })
    );
    expect(result.success).toBe(false);
  });

  it("lawyerReason null parses (privileged field, present only after lawyer disposition)", () => {
    const result = AssessmentLineSchema.safeParse(validLine({ lawyerReason: null }));
    expect(result.success).toBe(true);
  });
});
