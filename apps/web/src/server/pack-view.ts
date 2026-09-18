// apps/web/src/server/pack-view.ts
//
// buildIntakePackView() turns the loaded (real, uncoerced) SG-PDPA pack into
// a plain, serialisable object for the HR intake screen: the pack's own id,
// version and REAL status — this module calls loadDemoPack() only, never
// coercePackForDemoEngine(), so nothing it returns can be mistaken for the
// engine-invocation boundary's in-memory Active copy — its per-controller-
// type fee posture, and one entry per PRD §6.3 category carrying the pack's
// own `basis` string as the category-contextual hint. The hint text comes
// from the pack, never from a sentence typed here: PRD §10.2 calls this the
// place HR learns the rules over time, and a hint that disagrees with the
// pack teaches the wrong thing.

import "./server-only.ts";
import { loadDemoPack } from "./engine-invocation.ts";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_LABELS, type ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import type { FeePostureMap, VerificationStatus } from "@dsar/schemas/rule-pack";
import type { JurisdictionCode } from "@dsar/schemas/primitives";

export interface IntakePackCategoryView {
  categoryCode: ExpenseCategoryCode;
  label: string;
  hint: string;
  verificationStatus: VerificationStatus;
}

export interface IntakePackView {
  packId: string;
  version: string;
  status: string;
  jurisdictionCode: JurisdictionCode;
  feePosture: FeePostureMap;
  categories: IntakePackCategoryView[];
}

// The 15/21 stub categories in the committed pack carry no CategoryRule yet
// (D-16 defers full 21-category authoring to before Phase 6) — this text
// names that honestly rather than inventing a hint the pack doesn't carry.
const NOT_YET_AUTHORED_HINT = "This category has not yet been authored in the pack — Legal will decide.";

export function buildIntakePackView(): IntakePackView {
  const pack = loadDemoPack();
  const ruleByCategory = new Map(pack.categoryRules.map((rule) => [rule.categoryCode, rule]));

  const categories: IntakePackCategoryView[] = EXPENSE_CATEGORY_CODES.map((categoryCode) => {
    const rule = ruleByCategory.get(categoryCode);
    return {
      categoryCode,
      label: EXPENSE_CATEGORY_LABELS[categoryCode],
      hint: rule?.basis ?? NOT_YET_AUTHORED_HINT,
      verificationStatus: rule?.verificationStatus ?? "NEEDS_VERIFICATION",
    };
  });

  return {
    packId: pack.packId,
    version: pack.version,
    status: pack.status,
    jurisdictionCode: pack.jurisdiction.code,
    feePosture: pack.feePosture,
    categories,
  };
}
