// packages/engine/src/__fixtures__/flat-fee-pack.ts
//
// A hand-built fixture pack carrying a flat fee (FlatFeeSchema, D-02/D-12),
// built solely for flat-fee.test.ts (plan 02-06 Task 3). HK-shaped in
// structure only — the jurisdiction code echoes PRD §7.5's illustrative HK
// extract, which is the PRD's own worked example of a flat-fee-adjacent
// mechanism (the advisory HK.FLAT_FEE_CHECK matterFlagRule) — but this is
// NOT Phase 3's real HK-PDPO pack (packages/rulepacks) and authors no legal
// position, exactly like reference-pack.ts's own disclaimer for SG.
//
// Kept deliberately separate from reference-pack.ts (the PRD §14 SG
// fixture), which carries no flat fee and must stay that way so its own
// six-key Totals assertion is unaffected by this plan (see that fixture's
// own module note and reference-fixture.golden.test.ts's header).
//
// categoryRules carries one worked ALLOW rule (STAFF_TIME_SEARCH) so a
// fixture line actually reaches draftBaseline — a flat-fee comparison
// against a draftBaseline of zero proves nothing about the comparison
// itself. buildFlatFeeFixturePack()'s overrides let a test attach a
// binding aggregateCap on top, to prove the comparison reads the
// POST-cap draftBaseline, not the pre-cap sum (flat-fee.test.ts's own
// "aggregate cap already reduced the baseline" case).

import type { Cap, CategoryRule, FlatFee, RulePack } from "@dsar/schemas/rule-pack";
import type { Minor } from "@dsar/schemas/primitives";

// HKD 250.00 — comfortably above a single worked line's claim but not
// necessarily above three, so a test can choose whether it exceeds by
// varying the number/size of lines rather than this constant.
export const FLAT_FEE_FIXTURE_AMOUNT = 25000 as Minor;

const WORKED_CATEGORY_RULE: CategoryRule = {
  ruleId: "HK-FIXTURE.STAFF_TIME_SEARCH",
  categoryCode: "STAFF_TIME_SEARCH",
  treatment: "ALLOW",
  cap: null,
  conditions: [],
  basis: "Locating and retrieving the requested data — fixture rule, not a proposed legal position.",
  citation: { instrument: "N/A", provision: "N/A" },
  verificationStatus: "NEEDS_VERIFICATION",
  verificationNote: "Fixture only — see this module's own header.",
};

const DEFAULT_FLAT_FEE: FlatFee = {
  amount: FLAT_FEE_FIXTURE_AMOUNT,
  basis: "Illustrative flat processing fee — fixture only, not a proposed legal position.",
  citation: { instrument: "N/A", provision: "N/A" },
  verificationStatus: "NEEDS_VERIFICATION",
  verificationNote: null,
};

export function buildFlatFeeFixturePack(
  overrides: { flatFee?: FlatFee; aggregateCap?: Cap | null } = {}
): RulePack {
  return {
    packId: "FLAT-FEE-FIXTURE",
    jurisdiction: { code: "HK", name: "Hong Kong" },
    version: "2026.09.1-fixture",
    status: "ACTIVE",
    authoredBy: null,
    reviewedBy: null,
    reviewedOn: null,
    reviewDueOn: "2026-10-01",
    instruments: [],
    feePosture: {
      PRIVATE_ORGANISATION: "PERMITTED_NOT_EXCESSIVE",
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
      aggregateCap: overrides.aggregateCap ?? null,
    },
    categoryRules: [WORKED_CATEGORY_RULE],
    matterFlagRules: [],
    requestorNoticeTemplate: "A fee has been assessed for this request.",
    openQuestions: [],
    flatFee: overrides.flatFee ?? DEFAULT_FLAT_FEE,
  };
}

export const FLAT_FEE_FIXTURE_PACK = buildFlatFeeFixturePack();
