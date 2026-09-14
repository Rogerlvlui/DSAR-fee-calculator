// packages/schemas/src/__fixtures__/arbitraries.ts
//
// fast-check arbitraries for ExpenseLine, a minimal RulePack, and Assessment
// (SCHEMA-07). Deliberately exported: Phase 2's engine property tests reuse
// these rather than authoring a second set that could drift from this
// plan's assessment.property.test.ts harness.
//
// Every arbitrary produces the schema's *input* shape (z.input<...>) — the
// pre-brand plain-number shape a branded Minor field accepts — not the
// post-parse branded output. Pass the generated value through the
// corresponding schema's `.parse()` to get the branded, validated result.
//
// Ranges are bounded so a line's quantity * unitRate product, and any
// aggregation across lines, stays well inside Postgres's Int32 range
// (2^31 - 1).

import fc from "fast-check";
import type { z } from "zod";
import { EXPENSE_CATEGORY_CODES } from "../taxonomy.ts";
import { ExpenseLineSchema, ExpenseUnitSchema } from "../expense-line.ts";
import { FlagReasonCodeSchema, StaffGradeSchema } from "../primitives.ts";
import { RulePackSchema } from "../rule-pack.ts";
import { AssessmentLineSchema, AssessmentSchema, VerdictSchema } from "../assessment.ts";

const EXPENSE_UNITS = ExpenseUnitSchema.options;
const STAFF_GRADES = StaffGradeSchema.options;
const FLAG_REASON_CODES = FlagReasonCodeSchema.options;
const VERDICTS = VerdictSchema.options;

// ---------------------------------------------------------------------------
// ExpenseLine
// ---------------------------------------------------------------------------

export const expenseLineArb = fc
  .record({
    id: fc.uuid(),
    matterId: fc.uuid(),
    seq: fc.nat({ max: 100 }),
    categoryCode: fc.constantFrom(...EXPENSE_CATEGORY_CODES),
    description: fc.string({ maxLength: 100 }),
    quantity: fc.integer({ min: 1, max: 1_000 }),
    unit: fc.constantFrom(...EXPENSE_UNITS),
    unitRate: fc.integer({ min: 0, max: 100_000 }),
    incurredByGrade: fc.option(fc.constantFrom(...STAFF_GRADES), { nil: null }),
    isThirdPartyInvoiced: fc.boolean(),
    vendorName: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
    evidenceRef: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
    hrNote: fc.option(fc.string({ maxLength: 100 }), { nil: null }),
  })
  .map((line) => ({
    ...line,
    // claimedAmount must equal quantity * unitRate exactly — ExpenseLineSchema's
    // own superRefine enforces this (AC-08); derive it here rather than
    // generating an independently-random value that would almost always fail.
    claimedAmount: line.quantity * line.unitRate,
  })) as fc.Arbitrary<z.input<typeof ExpenseLineSchema>>;

// ---------------------------------------------------------------------------
// Minimal RulePack
// ---------------------------------------------------------------------------

const MINIMAL_PACK_JURISDICTIONS = [
  { code: "HK", name: "Hong Kong SAR" },
  { code: "SG", name: "Singapore" },
];

export const minimalRulePackArb = fc.record({
  packId: fc.string({ minLength: 3, maxLength: 20 }),
  jurisdiction: fc.constantFrom(...MINIMAL_PACK_JURISDICTIONS),
  version: fc.string({ minLength: 1, maxLength: 20 }),
  status: fc.constantFrom("DRAFT", "ACTIVE", "STALE", "WITHDRAWN"),
  authoredBy: fc.constant(null),
  reviewedBy: fc.constant(null),
  reviewedOn: fc.constant(null),
  reviewDueOn: fc.constant("2027-01-01"),
  instruments: fc.constant([]),
  feePosture: fc.constant({
    PRIVATE_ORGANISATION: "PERMITTED_NOT_EXCESSIVE",
    PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY",
  }),
  appliesTo: fc.constant(["PRIVATE_ORGANISATION"]),
  rateSanityCeiling: fc.constant({}),
  constraints: fc.constant({
    noChargeForMakingRequest: false,
    estimateRequiredBeforeCharging: false,
    feeNotificationDeadlineDays: 40,
    deadlineBasis: "CALENDAR_DAYS",
    responseDeadlineDays: 40,
    advancePaymentPermitted: true,
    mayWithholdDataUntilPaid: true,
    profitElementPermitted: false,
    deterrentUsePermitted: false,
    regulatorMayReviewFee: true,
    aggregateCap: null,
  }),
  categoryRules: fc.constant([]),
  matterFlagRules: fc.constant([]),
  requestorNoticeTemplate: fc.constant("..."),
  openQuestions: fc.constant([]),
}) as fc.Arbitrary<z.input<typeof RulePackSchema>>;

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

const flagReasonArb = fc.record({
  code: fc.constantFrom(...FLAG_REASON_CODES),
  message: fc.string({ maxLength: 50 }),
});

const assessmentLineArb = fc
  .constantFrom(...VERDICTS)
  .chain((verdict) =>
    fc.record({
      id: fc.uuid(),
      expenseLineId: fc.uuid(),
      verdict: fc.constant(verdict),
      engineAmount: fc.integer({ min: 0, max: 100_000 }),
      appliedRuleId: fc.string({ minLength: 1, maxLength: 30 }),
      appliedCap: fc.constant(null),
      basis: fc.string({ maxLength: 100 }),
      citation: fc.record({
        instrument: fc.string({ minLength: 1, maxLength: 20 }),
        provision: fc.string({ minLength: 1, maxLength: 20 }),
      }),
      // AssessmentLineSchema's own superRefine requires flagReasons
      // non-empty exactly when verdict is FLAG — generate accordingly
      // rather than relying on the refinement to reject the mismatch.
      flagReasons:
        verdict === "FLAG"
          ? fc.array(flagReasonArb, { minLength: 1, maxLength: 3 })
          : fc.constant([]),
      disposition: fc.constant("PENDING"),
      lawyerAmount: fc.constant(null),
      lawyerReason: fc.constant(null),
      dispositionedBy: fc.constant(null),
      dispositionedAt: fc.constant(null),
    })
  ) as fc.Arbitrary<z.input<typeof AssessmentLineSchema>>;

export const assessmentArb = fc.record({
  id: fc.uuid(),
  matterId: fc.uuid(),
  rulePackId: fc.string({ minLength: 1, maxLength: 20 }),
  rulePackVersion: fc.string({ minLength: 1, maxLength: 20 }),
  engineVersion: fc.string({ minLength: 1, maxLength: 20 }),
  computedAt: fc.constant("2026-09-15T00:00:00Z"),
  lines: fc.array(assessmentLineArb, { maxLength: 10 }),
  matterLevelFlags: fc.constant([]),
  totals: fc.record({
    claimedTotal: fc.integer({ min: 0, max: 1_000_000 }),
    draftBaseline: fc.integer({ min: 0, max: 1_000_000 }),
    disallowedTotal: fc.integer({ min: 0, max: 1_000_000 }),
    flaggedTotal: fc.integer({ min: 0, max: 1_000_000 }),
    restingOnUnverifiedRules: fc.integer({ min: 0, max: 1_000_000 }),
    finalAmount: fc.constant(null),
  }),
  signOff: fc.constant(null),
}) as fc.Arbitrary<z.input<typeof AssessmentSchema>>;
