// packages/engine/src/flat-fee.test.ts
//
// D-12 (02-CONTEXT.md) / ENGINE-16 (plan 02-06 Task 3) — the flat-fee
// comparison, both as a pure function (computeFlatFeeComparison) and wired
// end to end through assess()/totals.ts. Covers: no flat fee → totals keeps
// exactly six keys and no comparison property; the flat figure above/below
// the itemised baseline; the exact-equality boundary (strictly greater
// than, never inclusive); the comparison reading the POST-aggregate-cap
// baseline, not the pre-cap sum; and draftBaseline/finalAmount left
// unchanged by the presence of a flat fee.

import { describe, expect, it } from "vitest";
import type { Minor } from "@dsar/schemas/primitives";
import type { Cap, FlatFee } from "@dsar/schemas/rule-pack";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { computeFlatFeeComparison } from "./flat-fee.ts";
import { assess } from "./assess.ts";
import { REFERENCE_MATTER, REFERENCE_NOW } from "./__fixtures__/reference-matter.ts";
import { REFERENCE_FIXTURE_PACK } from "./__fixtures__/reference-pack.ts";
import { REFERENCE_FIXTURE_LINES } from "./__fixtures__/reference-lines.ts";
import { buildFlatFeeFixturePack } from "./__fixtures__/flat-fee-pack.ts";

const SAMPLE_FLAT_FEE: FlatFee = {
  amount: 10000 as Minor,
  basis: "Test flat fee basis.",
  citation: { instrument: "TEST", provision: "s.1" },
  verificationStatus: "VERIFIED",
  verificationNote: null,
};

describe("computeFlatFeeComparison — pure function", () => {
  it("returns undefined when the pack carries no flat fee", () => {
    expect(computeFlatFeeComparison(undefined, 5000 as Minor)).toBeUndefined();
  });

  it("reports exceeds: true when the flat figure is above the itemised baseline", () => {
    const result = computeFlatFeeComparison(SAMPLE_FLAT_FEE, 5000 as Minor);
    expect(result).toEqual({
      flatFeeAmount: 10000,
      itemisedDirectCostAmount: 5000,
      flatFeeExceedsItemisedCost: true,
    });
  });

  it("reports exceeds: false when the flat figure is below the itemised baseline", () => {
    const result = computeFlatFeeComparison(SAMPLE_FLAT_FEE, 15000 as Minor);
    expect(result?.flatFeeExceedsItemisedCost).toBe(false);
  });

  it("a flat figure exactly equal to the baseline reports NOT exceeding — the comparison is strict", () => {
    const result = computeFlatFeeComparison(SAMPLE_FLAT_FEE, 10000 as Minor);
    expect(result?.flatFeeExceedsItemisedCost).toBe(false);
  });
});

// Three equal-share STAFF_TIME_SEARCH lines. Deliberately three, not one —
// a single-line matter is unavoidably 100% of its own claim and trips step
// 4's materiality check regardless of posture (see reference-fixture.golden.
// test.ts's own note on this); three equal lines each sit at 33.3%, under
// the 40% threshold, so draftBaseline reflects only the ALLOW treatment and
// (where present) the aggregate cap — nothing else moves it.
// Named `unitRateNumber`, not `unitRate` — a bare-`number` parameter named
// with the AC-07a money suffix trips the branded-Minor ESLint rule even
// though this is genuinely pre-brand raw input to ExpenseLineSchema.parse()
// (the single sanctioned conversion point), matching cross-line-checks.
// test.ts's own established convention for this exact situation.
function buildThreeEqualLines(unitRateNumber: number): ExpenseLine[] {
  return [0, 1, 2].map((index) =>
    ExpenseLineSchema.parse({
      id: `flat-fee-line-${index}`,
      matterId: REFERENCE_MATTER.id,
      seq: index,
      categoryCode: "STAFF_TIME_SEARCH",
      description: `Staff time locating records, tranche ${index}`,
      quantity: 1,
      unit: "HOUR",
      unitRate: unitRateNumber,
      claimedAmount: unitRateNumber,
      incurredByGrade: null,
      isThirdPartyInvoiced: false,
      vendorName: null,
      evidenceRef: null,
      hrNote: null,
    })
  );
}

describe("flat-fee comparison — wired into assess()/totals.ts", () => {
  it("a pack with no flat fee leaves totals with exactly six keys and no comparison property", () => {
    const result = assess({
      matter: REFERENCE_MATTER,
      lines: REFERENCE_FIXTURE_LINES,
      pack: REFERENCE_FIXTURE_PACK,
      now: REFERENCE_NOW,
    });

    expect(Object.keys(result.totals).sort()).toEqual([
      "claimedTotal",
      "disallowedTotal",
      "draftBaseline",
      "finalAmount",
      "flaggedTotal",
      "restingOnUnverifiedRules",
    ]);
    expect(result.totals).not.toHaveProperty("flatFeeComparison");
  });

  it("a pack with a flat fee and no binding aggregate cap compares against the plain draftBaseline", () => {
    const lines = buildThreeEqualLines(10000); // 3 x 100.00 = 300.00 claimed/allowed
    const pack = buildFlatFeeFixturePack(); // FLAT_FEE_FIXTURE_AMOUNT = 25000 (250.00)

    const result = assess({ matter: REFERENCE_MATTER, lines, pack, now: REFERENCE_NOW });

    expect(result.totals.draftBaseline).toBe(30000);
    expect(result.totals.flatFeeComparison).toEqual({
      flatFeeAmount: 25000,
      itemisedDirectCostAmount: 30000,
      flatFeeExceedsItemisedCost: false, // 250.00 < 300.00
    });
    // draftBaseline and finalAmount are exactly what they would be without a
    // flat fee — computeFlatFeeComparison never adjusts either.
    expect(result.totals.draftBaseline).toBe(30000);
    expect(result.totals.finalAmount).toBeNull();
  });

  it("the comparison reads the POST-aggregate-cap draftBaseline, not the pre-cap sum", () => {
    const lines = buildThreeEqualLines(10000); // claimedTotal 30000
    const aggregateCap: Cap = { type: "PER_MATTER", amount: 15000 as Minor };
    const flatFee: FlatFee = { ...SAMPLE_FLAT_FEE, amount: 20000 as Minor };
    const pack = buildFlatFeeFixturePack({ aggregateCap, flatFee });

    const result = assess({ matter: REFERENCE_MATTER, lines, pack, now: REFERENCE_NOW });

    // Pro-rata over three equal 10000 shares against a binding 15000 cap:
    // floor(15000 * 10000 / 30000) = 5000 each, sum 15000, no residue.
    expect(result.totals.draftBaseline).toBe(15000);
    expect(result.totals.flatFeeComparison).toEqual({
      flatFeeAmount: 20000,
      itemisedDirectCostAmount: 15000,
      // 20000 > 15000 (post-cap) — but 20000 < 30000 (pre-cap). A wiring bug
      // that compared against the pre-cap sum would report false here.
      flatFeeExceedsItemisedCost: true,
    });
  });
});
