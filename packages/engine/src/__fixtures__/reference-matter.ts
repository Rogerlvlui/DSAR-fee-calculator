// packages/engine/src/__fixtures__/reference-matter.ts
//
// The SG / PRIVATE_ORGANISATION / SGD matter and REFERENCE_NOW every later
// engine fixture in this phase builds on (PRD §14's reference-matter
// description: isKnownDisputeOrLitigation true, isRepeatRequestWithin12Months
// false). Deliberately NOT the full six-line §14 fixture pack or its 21-rule
// pack — plan 02-04 owns those. This module gives Task 1's tracer test the
// smallest matter + one-category pack that reaches every layer of assess()
// on the ALLOW path.

import type { Matter } from "@dsar/schemas/matter";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule, RulePack } from "@dsar/schemas/rule-pack";

export const REFERENCE_NOW = "2026-09-15T00:00:00Z";

export const REFERENCE_MATTER: Matter = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  reference: "DSAR-2026-0001",
  jurisdictionCode: "SG",
  legalEntity: "Acme Pte Ltd",
  controllerType: "PRIVATE_ORGANISATION",
  requestReceivedOn: "2026-08-20",
  requestorClass: "FORMER_EMPLOYEE",
  currency: "SGD",
  identityVerified: true,
  identityVerifiedNote: null,
  scopeClarified: true,
  isRepeatRequestWithin12Months: false,
  isKnownDisputeOrLitigation: true,
  status: "DRAFT",
  createdBy: {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
    displayName: "Jane HR",
    email: "jane@example.com",
  },
  createdAt: "2026-09-01T03:14:15Z",
};

// 4 HOUR @ 4000 minor units = 16000 claimed — PRD §14's own STAFF_TIME_SEARCH
// treatment shape, reused here as the tracer's single line.
//
// Built via ExpenseLineSchema.parse() rather than a direct type-annotated
// object literal: unitRate/claimedAmount are branded Minor, and .parse() is
// the single sanctioned conversion point from a plain number literal to the
// branded type (primitives.ts) — this fixture module is exactly the kind of
// system boundary that comment describes, not the engine's own hot path.
export const REFERENCE_LINE: ExpenseLine = ExpenseLineSchema.parse({
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
  matterId: REFERENCE_MATTER.id,
  seq: 0,
  categoryCode: "STAFF_TIME_SEARCH",
  description: "Staff time locating and retrieving the requested records",
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

const REFERENCE_CATEGORY_RULE: CategoryRule = {
  ruleId: "SG-PDPA.STAFF_TIME_SEARCH",
  categoryCode: "STAFF_TIME_SEARCH",
  treatment: "ALLOW",
  cap: null,
  conditions: [],
  basis: "Direct staff time locating and retrieving the requested data.",
  citation: { instrument: "PDPA", provision: "s.30" },
  verificationStatus: "VERIFIED",
  verificationNote: null,
};

// A small ALLOW-only pack sufficient for one line — not the full 21-category
// reference pack (that is plan 02-04's job). `overrides.categoryRule` lets a
// test build the NEEDS_VERIFICATION variant without duplicating the whole
// pack shape.
export function buildReferencePack(overrides: { categoryRule?: Partial<CategoryRule> } = {}): RulePack {
  const categoryRule: CategoryRule = { ...REFERENCE_CATEGORY_RULE, ...overrides.categoryRule };

  return {
    packId: "SG-PDPA-REFERENCE",
    jurisdiction: { code: "SG", name: "Singapore" },
    version: "2026.09.1-fixture",
    status: "ACTIVE",
    authoredBy: null,
    reviewedBy: null,
    reviewedOn: null,
    reviewDueOn: "2026-10-01",
    instruments: [{ title: "Personal Data Protection Act 2012", provisions: ["s.30"] }],
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
      aggregateCap: null,
    },
    categoryRules: [categoryRule],
    matterFlagRules: [],
    requestorNoticeTemplate: "A fee has been assessed for this request.",
    openQuestions: [],
  };
}

export const REFERENCE_PACK = buildReferencePack();
