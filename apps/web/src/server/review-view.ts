// apps/web/src/server/review-view.ts
//
// buildReviewView() assembles the serialisable props the legal review
// screen needs beyond what Assessment already carries: for each assessment
// line, the originating expense line's description/category/quantity/unit/
// rate, and the applied rule's verification status read from the real,
// uncoerced pack this assessment was actually PINNED to
// (resolvePinnedRulePack, by the assessment's own rulePackId/rulePackVersion)
// — never a literal, and never the engine-invocation boundary's
// ACTIVE-coerced copy. Most authored category rules in the committed HK/SG
// packs are NEEDS_VERIFICATION, so most lines' verificationStatus below
// reads that value honestly (03.1-UI-SPEC.md's Known Deviation note) — it is
// not hard-coded here.
//
// Also computes the one deadline the matter rail displays: the real pack
// sets `feeNotificationDeadlineDays: null` and `responseDeadlineDays: 30`,
// so the advisory line falls back to the response deadline exactly as
// Annex A's own SG card does (docs/dsar-fee-agent-mockup.html:934) — never
// inventing a fee-notification date the pack doesn't set.

import "./server-only.ts";
import type { Assessment } from "@dsar/schemas/assessment";
import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine, ExpenseUnit } from "@dsar/schemas/expense-line";
import type { MatterFlag, Minor } from "@dsar/schemas/primitives";
import type { VerificationStatus } from "@dsar/schemas/rule-pack";
import { EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";
import { resolvePinnedRulePack } from "./engine-invocation.ts";
import { computeAdvisoryDeadline, type AdvisoryDeadlineView } from "../domain/advisory-deadline.ts";

export interface ReviewLineView {
  assessmentLineId: string;
  expenseLineId: string;
  seq: number;
  categoryLabel: string;
  description: string;
  quantity: number;
  unit: ExpenseUnit;
  unitRate: Minor;
  claimedAmount: Minor;
  verificationStatus: VerificationStatus;
}

export interface ReviewView {
  lines: ReviewLineView[];
  matterFlags: readonly MatterFlag[];
  advisoryDeadline: AdvisoryDeadlineView | null;
}

export function buildReviewView(
  assessment: Assessment,
  matter: Matter,
  lines: readonly ExpenseLine[],
  now: string = new Date().toISOString()
): ReviewView {
  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
  const ruleById = new Map(pack.categoryRules.map((rule) => [rule.ruleId, rule]));
  const expenseLineById = new Map(lines.map((line) => [line.id, line]));

  const reviewLines: ReviewLineView[] = assessment.lines.map((line) => {
    const expenseLine = expenseLineById.get(line.expenseLineId);
    const rule = ruleById.get(line.appliedRuleId);
    return {
      assessmentLineId: line.id,
      expenseLineId: line.expenseLineId,
      seq: expenseLine?.seq ?? 0,
      categoryLabel: expenseLine ? EXPENSE_CATEGORY_LABELS[expenseLine.categoryCode] : "Unknown category",
      description: expenseLine?.description ?? "",
      quantity: expenseLine?.quantity ?? 0,
      unit: expenseLine?.unit ?? "FIXED",
      unitRate: expenseLine?.unitRate ?? (0 as Minor),
      claimedAmount: expenseLine?.claimedAmount ?? (0 as Minor),
      verificationStatus: rule?.verificationStatus ?? "NEEDS_VERIFICATION",
    };
  });

  return {
    lines: reviewLines,
    matterFlags: assessment.matterLevelFlags,
    advisoryDeadline: computeAdvisoryDeadline(matter, pack.constraints, now),
  };
}
