// packages/engine/src/__fixtures__/reference-pack.ts
//
// PRD §14's six-line reference fixture — a hand-built, SG-shaped RulePack
// reproducing §14's published verdicts, amounts and totals exactly. This is
// NOT a rule pack: it authors no legal position, and it is NOT Phase 3's
// real SG-PDPA pack (packages/rulepacks). It exists solely so plan 02-04's
// golden test (reference-fixture.golden.test.ts) has something to run
// assess() against — a fixture that happens to look like a pack is exactly
// the kind of thing a later reader might mistakenly promote, so this note
// is deliberate and repeated at every call site that matters.
//
// Six categories carry the treatments PRD §14's table needs
// (STAFF_TIME_SEARCH, STAFF_TIME_COLLATE, STAFF_TIME_ASSESS_EXEMPTIONS,
// PHOTOCOPY_PRINT, VENDOR_PAYROLL, OTHER_UNCLASSIFIED); the schema requires
// all 21 ExpenseCategoryCode entries to be present (CategoryRuleSchema is
// declared as an array with no cardinality check at the schema level —
// PACK-02's 21/21 exhaustiveness check is a Phase 3 build-time validator,
// not this schema), so the remaining 15 are terse, uninteresting DISALLOW
// filler rules that no fixture line in reference-lines.ts references.

import type { CategoryRule, RulePack } from "@dsar/schemas/rule-pack";
import type { ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import type { Minor } from "@dsar/schemas/primitives";

// The six categories PRD §14's table exercises, and the exact
// verificationStatus each must carry. Research derived the first two
// (STAFF_TIME_SEARCH VERIFIED, STAFF_TIME_COLLATE NEEDS_VERIFICATION) by
// arithmetic from §14's own published restingOnUnverifiedRules figure
// (106.40 = 80.00 + 26.40, not 160.00 + 80.00 + 26.40 — see
// 02-RESEARCH.md Pattern 1). §7.6 describes the REAL SG-PDPA production
// pack as shipping all 21 categories NEEDS_VERIFICATION initially — that
// is a different pack; copying that description into this fixture would
// make the golden test fail by exactly 160.00.
const WORKED_CATEGORY_CODES: ExpenseCategoryCode[] = [
  "STAFF_TIME_SEARCH",
  "STAFF_TIME_COLLATE",
  "STAFF_TIME_ASSESS_EXEMPTIONS",
  "PHOTOCOPY_PRINT",
  "VENDOR_PAYROLL",
  "OTHER_UNCLASSIFIED",
];

const WORKED_CATEGORY_RULES: CategoryRule[] = [
  {
    ruleId: "SG-PDPA-FIXTURE.STAFF_TIME_SEARCH",
    categoryCode: "STAFF_TIME_SEARCH",
    treatment: "ALLOW",
    cap: null,
    conditions: [],
    basis: "Locating and retrieving the requested data is a service provided to the applicant to enable the organisation to respond.",
    citation: { instrument: "PDPA", provision: "s.21" },
    // RED (plan 02-04 Task 3): deliberately NEEDS_VERIFICATION here,
    // copying §7.6's "all 21 categories ship NEEDS_VERIFICATION" description
    // of the REAL production pack — the exact mistake 02-RESEARCH.md
    // Pattern 1 warns against. GREEN fixes this to VERIFIED.
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: null,
  },
  {
    ruleId: "SG-PDPA-FIXTURE.STAFF_TIME_COLLATE",
    categoryCode: "STAFF_TIME_COLLATE",
    treatment: "ALLOW",
    cap: null,
    conditions: [],
    basis: "Compiling and paginating the response is likewise such a service.",
    citation: { instrument: "PDPA", provision: "s.21" },
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: "Reg. 7's 'services provided to enable the organisation to respond' limb — counsel to confirm.",
  },
  {
    ruleId: "SG-PDPA-FIXTURE.STAFF_TIME_ASSESS_EXEMPTIONS",
    categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS",
    treatment: "DISALLOW",
    cap: null,
    conditions: [],
    basis: "Time assessing whether an exception applies is the organisation's own compliance cost, not a service provided to the applicant.",
    citation: { instrument: "PDPA", provision: "s.21" },
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: "Whether any element of the claim relates to assessing exceptions rather than providing access — counsel to confirm.",
  },
  {
    ruleId: "SG-PDPA-FIXTURE.PHOTOCOPY_PRINT",
    categoryCode: "PHOTOCOPY_PRINT",
    treatment: "ALLOW_WITH_CAP",
    cap: { type: "PER_UNIT", amount: 12 as Minor, unit: "PAGE" },
    conditions: [],
    basis: "Reproduction at a standard per-page rate not exceeding the entity's actual direct cost.",
    citation: { instrument: "PDPA Regulations 2021", provision: "reg.7" },
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: "The per-page figure is entity-specific and must not exceed actual direct cost — counsel to confirm before activation.",
  },
  {
    ruleId: "SG-PDPA-FIXTURE.VENDOR_PAYROLL",
    categoryCode: "VENDOR_PAYROLL",
    treatment: "ALLOW_IF",
    cap: null,
    conditions: [
      { field: "isThirdPartyInvoiced", op: "eq", value: true },
      { field: "evidenceRef", op: "isNotNull" },
    ],
    basis: "Out-of-pocket charge paid to a third party for data the employer does not itself hold, where invoiced and evidenced.",
    citation: { instrument: "PDPA", provision: "s.21" },
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: "Recoverable only to the extent necessary — counsel to confirm.",
  },
  {
    ruleId: "SG-PDPA-FIXTURE.OTHER_UNCLASSIFIED",
    categoryCode: "OTHER_UNCLASSIFIED",
    treatment: "FLAG",
    cap: null,
    conditions: [],
    basis: "Uncategorised cost. Legal to determine whether it is directly related to and necessary for compliance.",
    citation: { instrument: "PDPA", provision: "s.21" },
    verificationStatus: "VERIFIED",
    verificationNote: null,
  },
];

// Terse, uninteresting filler for every category this fixture's six lines
// do not reference — present only so the schema's full CategoryRule[]
// array is complete (PACK-02's 21/21 exhaustiveness is a Phase 3 build-time
// check, not a RulePackSchema constraint). DISALLOW, not FLAG: a plain
// FLAG treatment forces a choice of FlagReasonCode that PRD §7.5/§7.6 only
// ever exercise for OTHER_UNCLASSIFIED, and these filler rules assert
// nothing about that question either way — see evaluate-line.ts's own
// module note on the one non-OTHER_UNCLASSIFIED FLAG-treatment branch.
function fillerCategoryRule(categoryCode: ExpenseCategoryCode): CategoryRule {
  return {
    ruleId: `SG-PDPA-FIXTURE.${categoryCode}`,
    categoryCode,
    treatment: "DISALLOW",
    cap: null,
    conditions: [],
    basis: "Filler rule for plan 02-04's engine fixture — not a proposed legal position, and no fixture line references this category.",
    citation: { instrument: "N/A", provision: "N/A" },
    verificationStatus: "NEEDS_VERIFICATION",
    verificationNote: "Filler only — see the module header on reference-pack.ts.",
  };
}

const ALL_CATEGORY_RULES: CategoryRule[] = EXPENSE_CATEGORY_CODES.map((categoryCode) => {
  const worked = WORKED_CATEGORY_RULES.find((rule) => rule.categoryCode === categoryCode);
  return worked ?? fillerCategoryRule(categoryCode);
});

export function buildReferenceFixturePack(): RulePack {
  return {
    packId: "SG-PDPA-REFERENCE-FIXTURE",
    jurisdiction: { code: "SG", name: "Singapore" },
    version: "2026.09.1-fixture",
    status: "ACTIVE",
    authoredBy: null,
    reviewedBy: null,
    reviewedOn: null,
    // 16 days after REFERENCE_NOW ("2026-09-15T00:00:00Z") — inside the
    // 30-day STALE_PACK_WARNING window plan 02-06 will assert, but not
    // past due (which plan 02-01's staleness precondition would reject
    // outright, AC-39). Deliberately NOT §7.6's real 2027-03-12 — that
    // date would never trip the 30-day warning this fixture is built to
    // exercise later in this phase.
    reviewDueOn: "2026-10-01",
    instruments: [
      { title: "Personal Data Protection Act 2012", provisions: ["s.21", "s.48H"] },
      { title: "Personal Data Protection Regulations 2021", provisions: ["reg.7"] },
    ],
    feePosture: {
      PRIVATE_ORGANISATION: "PERMITTED_REASONABLE",
      PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY",
    },
    appliesTo: ["PRIVATE_ORGANISATION"],
    rateSanityCeiling: { ADMIN: 3000 as Minor, EXECUTIVE: 5000 as Minor, MANAGER: 9000 as Minor },
    constraints: {
      noChargeForMakingRequest: true,
      estimateRequiredBeforeCharging: true,
      feeNotificationDeadlineDays: null,
      deadlineBasis: "CALENDAR_DAYS",
      responseDeadlineDays: 30,
      advancePaymentPermitted: true,
      mayWithholdDataUntilPaid: true,
      profitElementPermitted: false,
      deterrentUsePermitted: false,
      regulatorMayReviewFee: true,
      // Plan 02-05 builds its own narrow aggregate-cap fixture rather
      // than disturbing this one (matches §7.6's real SG posture: null).
      aggregateCap: null,
    },
    categoryRules: ALL_CATEGORY_RULES,
    // §7.6's three informational SG flags, verbatim, each firing
    // unconditionally — plan 02-06 consumes these; authored here so this
    // fixture is complete in one place.
    matterFlagRules: [
      {
        flagId: "SG.WRITTEN_ESTIMATE",
        when: { always: true },
        message:
          "A written estimate of the fee must be given to the applicant before the fee is charged. If the eventual fee will exceed the estimate, a further written estimate is required.",
        requiresAcknowledgement: false,
      },
      {
        flagId: "SG.RESPOND_30_DAYS",
        when: { always: true },
        message:
          "Respond within 30 days. If that is not possible, notify the applicant in writing of the time by which a response will be provided.",
        requiresAcknowledgement: false,
      },
      {
        flagId: "SG.NOT_A_DETERRENT",
        when: { always: true },
        message:
          "The fee must be reasonable and must not be used to discourage the applicant from pursuing the request. The Commission may review the reasonableness of the fee.",
        requiresAcknowledgement: false,
      },
    ],
    requestorNoticeTemplate: "A fee has been assessed for this request.",
    openQuestions: [
      "Whether staff time is being costed at incremental cost or at a loaded charge-out rate.",
      "Whether any element of the claim relates to assessing exceptions rather than providing access.",
    ],
  };
}

export const REFERENCE_FIXTURE_PACK = buildReferenceFixturePack();

// Re-exported so a reader of the worked-rule set doesn't need to open
// EXPENSE_CATEGORY_CODES separately to see which six categories matter.
export const WORKED_REFERENCE_CATEGORY_CODES = WORKED_CATEGORY_CODES;
