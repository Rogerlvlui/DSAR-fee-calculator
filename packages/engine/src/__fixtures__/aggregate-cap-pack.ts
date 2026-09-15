// packages/engine/src/__fixtures__/aggregate-cap-pack.ts
//
// A small dedicated fixture pack carrying a binding aggregate cap, built
// solely for aggregate-cap.test.ts (plan 02-05 Task 2). Kept deliberately
// separate from reference-pack.ts's PRD §14 fixture — that fixture's own
// `constraints.aggregateCap` stays null throughout this phase (matching
// §7.6's real SG posture, plan 02-04's own note), and no plan in this phase
// touches that value. No production-shaped SG/HK pack has authored a
// non-null aggregateCap yet (Phase 3), so this behaviour is proven on a
// purpose-built fixture rather than under fixture-matching pressure against
// a real pack's other numbers.
//
// This is NOT a rule pack: like reference-pack.ts, it authors no legal
// position. `categoryRules` is deliberately empty — aggregate-cap.ts's step
// function only ever reads `pack.constraints.aggregateCap`, never
// `pack.categoryRules`, so there is nothing for a category rule to prove
// here.

import type { Cap, RulePack } from "@dsar/schemas/rule-pack";
import type { Minor } from "@dsar/schemas/primitives";

export const AGGREGATE_CAP_FIXTURE_AMOUNT = 250 as Minor;

export function buildAggregateCapFixturePack(overrides: { aggregateCap?: Cap | null } = {}): RulePack {
  const aggregateCap: Cap | null =
    overrides.aggregateCap !== undefined
      ? overrides.aggregateCap
      : { type: "PER_MATTER", amount: AGGREGATE_CAP_FIXTURE_AMOUNT };

  return {
    packId: "AGGREGATE-CAP-FIXTURE",
    jurisdiction: { code: "SG", name: "Singapore" },
    version: "2026.09.1-fixture",
    status: "ACTIVE",
    authoredBy: null,
    reviewedBy: null,
    reviewedOn: null,
    reviewDueOn: "2026-10-01",
    instruments: [],
    feePosture: {
      PRIVATE_ORGANISATION: "PERMITTED_REASONABLE",
      PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY",
    },
    appliesTo: ["PRIVATE_ORGANISATION"],
    rateSanityCeiling: {},
    constraints: {
      noChargeForMakingRequest: false,
      estimateRequiredBeforeCharging: false,
      feeNotificationDeadlineDays: null,
      deadlineBasis: "CALENDAR_DAYS",
      responseDeadlineDays: null,
      advancePaymentPermitted: true,
      mayWithholdDataUntilPaid: true,
      profitElementPermitted: false,
      deterrentUsePermitted: false,
      regulatorMayReviewFee: true,
      aggregateCap,
    },
    categoryRules: [],
    matterFlagRules: [],
    requestorNoticeTemplate: "A fee has been assessed for this request.",
    openQuestions: [],
  };
}

export const AGGREGATE_CAP_FIXTURE_PACK = buildAggregateCapFixturePack();
