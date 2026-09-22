// packages/engine/src/assess.property.test.ts
//
// AC-07(b) — a 10,000-run fast-check property over REAL assess() output,
// not the hand-constructed Assessment values packages/schemas's own
// SCHEMA-07 harness still generates directly
// (packages/schemas/src/assessment.property.test.ts — see that file's
// updated module note). Reuses expenseLineArb/minimalRulePackArb from
// packages/schemas/src/__fixtures__/arbitraries.ts, exported by Phase 1
// specifically for this re-point, rather than authoring a second set that
// could drift from the one packages/schemas's own suite relies on.
//
// packages/schemas must not gain a dependency on packages/engine — doing
// the re-point in assessment.property.test.ts itself would invert the
// package graph the whole architecture rests on (packages/engine is the
// downstream consumer of the freeze, never the other way round). This file
// lives in packages/engine instead, satisfying the same intent from the
// correct side of the boundary.
//
// RECORDED_SEED is the SAME seed packages/schemas's own harness uses, so a
// counterexample is replayable rather than a one-off observation.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { z } from "zod";
import { AssessmentSchema } from "@dsar/schemas/assessment";
import { expenseLineArb, minimalRulePackArb } from "@dsar/schemas/__fixtures__/arbitraries";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { RulePackSchema, type CategoryRule, type RulePack } from "@dsar/schemas/rule-pack";
import { EXPENSE_CATEGORY_CODES, type ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import { JURISDICTION_CURRENCY, type JurisdictionCode } from "@dsar/schemas/primitives";
import type { Matter } from "@dsar/schemas/matter";
import { assess } from "./assess.ts";

const RECORDED_SEED = 20260915;
const NUM_RUNS = 10_000;

// Comfortably clear of both the staleness precondition and the 30-day
// STALE_PACK_WARNING window — this property is about the money invariants,
// not the matter-flag surface.
const FAR_FUTURE_REVIEW_DATE = "2099-01-01";
const NOW = "2026-01-01T00:00:00Z";

// A full ALLOW rule for one category, alternating VERIFIED/NEEDS_VERIFICATION
// by the category's position in the closed taxonomy — so the
// restingOnUnverifiedRules <= draftBaseline invariant is exercised against a
// genuine subset on most runs, not a fixture that is always 100% or 0%
// verified. AC-19's OTHER_UNCLASSIFIED override (evaluate-line.ts) still
// forces that one category to FLAG regardless of this rule's own
// treatment — no special-casing needed here.
function buildAllowCategoryRule(categoryCode: ExpenseCategoryCode): CategoryRule {
  return {
    ruleId: `PROPERTY-FIXTURE.${categoryCode}`,
    categoryCode,
    treatment: "ALLOW",
    cap: null,
    conditions: [],
    basis: "Property-test fixture rule — not a proposed legal position.",
    citation: { instrument: "N/A", provision: "N/A" },
    verificationStatus: EXPENSE_CATEGORY_CODES.indexOf(categoryCode) % 2 === 0 ? "VERIFIED" : "NEEDS_VERIFICATION",
    verificationNote: null,
  };
}

// Derives a full ACTIVE pack from the generated minimal one — forcing
// exactly what the engine's step-1 preconditions require to pass (ACTIVE
// status, a far-future reviewDueOn, a PRIVATE_ORGANISATION posture that does
// not short-circuit step 3's treatment table) — plus a CategoryRule for
// every category the generated lines actually use. A generated input that
// mostly exercises the precondition throw would prove nothing about the
// totals; this keying is what guarantees every generated case reaches full
// evaluation instead.
function buildTestPack(rawPack: z.input<typeof RulePackSchema>, categoryCodes: readonly ExpenseCategoryCode[]): RulePack {
  const merged: z.input<typeof RulePackSchema> = {
    ...rawPack,
    status: "ACTIVE",
    reviewDueOn: FAR_FUTURE_REVIEW_DATE,
    feePosture: {
      PRIVATE_ORGANISATION: "PERMITTED_REASONABLE",
      PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY",
    },
    appliesTo: ["PRIVATE_ORGANISATION"],
    categoryRules: categoryCodes.map(buildAllowCategoryRule),
  };
  return RulePackSchema.parse(merged);
}

function buildTestMatter(jurisdictionCode: JurisdictionCode): Matter {
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FA0",
    reference: "PROPERTY-FIXTURE",
    jurisdictionCode,
    legalEntity: "Property Fixture Pte Ltd",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: "2026-01-01",
    requestorClass: "FORMER_EMPLOYEE",
    currency: JURISDICTION_CURRENCY[jurisdictionCode],
    identityVerified: true,
    identityVerifiedNote: null,
    scopeClarified: true,
    isRepeatRequestWithin12Months: false,
    isKnownDisputeOrLitigation: false,
    status: "DRAFT",
    createdBy: { id: "01ARZ3NDEKTSV4RRFFQ69G5FA1", displayName: "Fixture HR", email: "fixture@example.com" },
    createdAt: NOW,
  };
}

interface GeneratedCase {
  matter: Matter;
  lines: ExpenseLine[];
  pack: RulePack;
}

// At least one line per case (never zero) — a generated input with no
// lines at all would reach evaluation trivially, proving nothing about the
// per-line/totals formulas this property exists to check.
const testCaseArb: fc.Arbitrary<GeneratedCase> = fc
  .tuple(minimalRulePackArb, fc.array(expenseLineArb, { minLength: 1, maxLength: 5 }))
  .map(([rawPack, rawLines]) => {
    const lines = rawLines.map((line) => ExpenseLineSchema.parse(line));
    const categoryCodes = Array.from(new Set(lines.map((line) => line.categoryCode)));
    const pack = buildTestPack(rawPack, categoryCodes);
    const matter = buildTestMatter(rawPack.jurisdiction.code);
    return { matter, lines, pack };
  });

describe("assess() money-integrity property (AC-07b, AC-22, AC-25)", () => {
  it(`holds the integer/totals invariants over ${NUM_RUNS} generated real assess() outputs (seed ${RECORDED_SEED})`, () => {
    fc.assert(
      fc.property(testCaseArb, ({ matter, lines, pack }) => {
        const result = assess({ matter, lines, pack, now: NOW });

        // Reached full evaluation, not merely the precondition throw — every
        // generated line produced exactly one assessment line.
        expect(result.lines.length).toBe(lines.length);
        expect(result.lines.length).toBeGreaterThan(0);

        // AC-07(b): every money field is an integer, never NaN.
        const moneyFields: number[] = [
          result.totals.claimedTotal,
          result.totals.draftBaseline,
          result.totals.disallowedTotal,
          result.totals.flaggedTotal,
          result.totals.restingOnUnverifiedRules,
          ...result.lines.map((line) => line.engineAmount),
        ];
        for (const value of moneyFields) {
          expect(Number.isInteger(value)).toBe(true);
          expect(Number.isNaN(value)).toBe(false);
        }

        // AC-25: finalAmount stays null pre-sign-off, never defaulted.
        expect(result.totals.finalAmount).toBeNull();

        // claimedTotal = sum of every expense line's claimed amount.
        const expectedClaimedTotal = lines.reduce((sum, line) => sum + line.claimedAmount, 0);
        expect(result.totals.claimedTotal).toBe(expectedClaimedTotal);

        // draftBaseline = sum of engineAmount for ALLOW/ALLOW_CAPPED lines.
        const expectedDraftBaseline = result.lines
          .filter((line) => line.verdict === "ALLOW" || line.verdict === "ALLOW_CAPPED")
          .reduce((sum, line) => sum + line.engineAmount, 0);
        expect(result.totals.draftBaseline).toBe(expectedDraftBaseline);

        // flaggedTotal = sum of the CLAIMED amount (not engineAmount) for
        // FLAG lines (AC-11 — a flagged line's claim is visible without
        // touching the fee).
        const claimedByExpenseLineId = new Map(lines.map((line) => [line.id, line.claimedAmount]));
        const expectedFlaggedTotal = result.lines
          .filter((line) => line.verdict === "FLAG")
          .reduce((sum, line) => sum + (claimedByExpenseLineId.get(line.expenseLineId) ?? 0), 0);
        expect(result.totals.flaggedTotal).toBe(expectedFlaggedTotal);

        // AC-22: restingOnUnverifiedRules is a SUBSET of draftBaseline, never
        // greater than it.
        expect(result.totals.restingOnUnverifiedRules).toBeLessThanOrEqual(result.totals.draftBaseline);
      }),
      { numRuns: NUM_RUNS, seed: RECORDED_SEED }
    );
  });

  it(`every generated real assess() output parses against the frozen AssessmentSchema (same ${NUM_RUNS} runs, seed ${RECORDED_SEED})`, () => {
    fc.assert(
      fc.property(testCaseArb, ({ matter, lines, pack }) => {
        const result = assess({ matter, lines, pack, now: NOW });
        expect(() => AssessmentSchema.parse(result)).not.toThrow();
      }),
      { numRuns: NUM_RUNS, seed: RECORDED_SEED }
    );
  });
});
