// apps/web/src/server/jurisdiction-packs.ts
//
// Replaces apps/web/src/server/pack-view.ts: buildIntakePackView() answered
// for SG-PDPA only, with every other jurisdiction hardcoded to
// NO_EXPRESS_AUTHORITY at the caller (05-RESEARCH.md Open Question 3, a
// demo simplification, not a designed one). This module resolves ALL nine
// committed jurisdiction packs individually against `PACK_JURISDICTIONS`
// (@dsar/rulepacks/stub-category-rules), deriving each one's real,
// uncoerced status via @dsar/rulepacks/stale — never a second staleness
// calculation, never a second hardcoded jurisdiction list.
//
// `resolveJurisdictionPackViews` is PURE (loaded packs + `now` in, a view
// map out) so the defensive "no usable pack" branch is provable with a
// hand-built pack list rather than by deleting a committed file.
// `buildJurisdictionPackViews` is the one thin IO wrapper everything
// outside this module's own test file calls.

import "./server-only.ts";
import { loadAllRulePacks } from "@dsar/rulepacks/loader";
import { deriveEffectiveStatus, daysUntilReviewDue } from "@dsar/rulepacks/stale";
import { PACK_JURISDICTIONS } from "@dsar/rulepacks/stub-category-rules";
import { EXPENSE_CATEGORY_CODES, EXPENSE_CATEGORY_LABELS, type ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import type { FeePostureMap, LoadableRulePack, VerificationStatus } from "@dsar/schemas/rule-pack";
import type { JurisdictionCode } from "@dsar/schemas/primitives";
import { resolveRulepacksRoot } from "./rulepacks-root.ts";

export type JurisdictionPackDisplayStatus = "ACTIVE" | "ACTIVE_REVIEW_DUE_SOON" | "STALE" | "DRAFT" | "NO_USABLE_PACK";

export interface JurisdictionPackCategoryView {
  categoryCode: ExpenseCategoryCode;
  label: string;
  hint: string;
  verificationStatus: VerificationStatus;
}

export interface JurisdictionPackView {
  jurisdictionCode: JurisdictionCode;
  jurisdictionName: string;
  packId: string | null;
  version: string | null;
  displayStatus: JurisdictionPackDisplayStatus;
  daysUntilReviewDue: number | null;
  feePosture: FeePostureMap | null;
  constraints: { feeNotificationDeadlineDays: number | null; responseDeadlineDays: number | null } | null;
  authoredByDisplayName: string | null;
  reviewedByDisplayName: string | null;
  reviewedOn: string | null;
  categories: JurisdictionPackCategoryView[];
}

// The 15/21 stub categories in a committed pack carry no CategoryRule yet
// (D-16 defers full 21-category authoring to before Phase 6) — this text
// names that honestly rather than inventing a hint the pack doesn't carry.
// Carried over verbatim from pack-view.ts, the module this replaces.
const NOT_YET_AUTHORED_HINT = "This category has not yet been authored in the pack — Legal will decide.";

function buildCategories(pack: LoadableRulePack): JurisdictionPackCategoryView[] {
  const ruleByCategory = new Map(pack.categoryRules.map((rule) => [rule.categoryCode, rule]));
  return EXPENSE_CATEGORY_CODES.map((categoryCode) => {
    const rule = ruleByCategory.get(categoryCode);
    return {
      categoryCode,
      label: EXPENSE_CATEGORY_LABELS[categoryCode],
      hint: rule?.basis ?? NOT_YET_AUTHORED_HINT,
      verificationStatus: rule?.verificationStatus ?? "NEEDS_VERIFICATION",
    };
  });
}

function deriveDisplayStatus(pack: LoadableRulePack, now: string): { displayStatus: JurisdictionPackDisplayStatus; daysUntilReviewDue: number } {
  const effectiveStatus = deriveEffectiveStatus(pack, now);
  const days = daysUntilReviewDue(pack, now);
  if (effectiveStatus === "STALE") {
    return { displayStatus: "STALE", daysUntilReviewDue: days };
  }
  if (effectiveStatus === "ACTIVE") {
    return { displayStatus: days <= 30 ? "ACTIVE_REVIEW_DUE_SOON" : "ACTIVE", daysUntilReviewDue: days };
  }
  // "DRAFT" or "WITHDRAWN" — a WITHDRAWN pack is not distinguished from
  // DRAFT in this phase's display, since no committed pack is ever
  // WITHDRAWN and no requirement asks for a sixth display state.
  return { displayStatus: "DRAFT", daysUntilReviewDue: days };
}

/** Pure: every test above drives this function directly, never the IO
 * wrapper below, so the defensive "no usable pack" branch is provable with
 * a hand-built pack list. */
export function resolveJurisdictionPackViews(
  loadedPacks: readonly LoadableRulePack[],
  now: string
): Record<JurisdictionCode, JurisdictionPackView> {
  const packByJurisdiction = new Map(loadedPacks.map((pack) => [pack.jurisdiction.code, pack]));

  const entries = PACK_JURISDICTIONS.map((row) => {
    const pack = packByJurisdiction.get(row.jurisdictionCode);
    if (!pack) {
      const view: JurisdictionPackView = {
        jurisdictionCode: row.jurisdictionCode,
        jurisdictionName: row.jurisdictionName,
        packId: null,
        version: null,
        displayStatus: "NO_USABLE_PACK",
        daysUntilReviewDue: null,
        feePosture: null,
        constraints: null,
        authoredByDisplayName: null,
        reviewedByDisplayName: null,
        reviewedOn: null,
        categories: [],
      };
      return [row.jurisdictionCode, view] as const;
    }

    const { displayStatus, daysUntilReviewDue: days } = deriveDisplayStatus(pack, now);
    const view: JurisdictionPackView = {
      jurisdictionCode: row.jurisdictionCode,
      jurisdictionName: row.jurisdictionName,
      packId: pack.packId,
      version: pack.version,
      displayStatus,
      daysUntilReviewDue: days,
      feePosture: pack.feePosture,
      constraints: {
        feeNotificationDeadlineDays: pack.constraints.feeNotificationDeadlineDays,
        responseDeadlineDays: pack.constraints.responseDeadlineDays,
      },
      authoredByDisplayName: pack.authoredBy?.displayName ?? null,
      reviewedByDisplayName: pack.reviewedBy?.displayName ?? null,
      reviewedOn: pack.reviewedOn,
      categories: buildCategories(pack),
    };
    return [row.jurisdictionCode, view] as const;
  });

  return Object.fromEntries(entries) as Record<JurisdictionCode, JurisdictionPackView>;
}

/** The only function anything outside this module's own test file calls. */
export function buildJurisdictionPackViews(now: string = new Date().toISOString()): Record<JurisdictionCode, JurisdictionPackView> {
  const loadedPacks = loadAllRulePacks(resolveRulepacksRoot());
  return resolveJurisdictionPackViews(loadedPacks, now);
}
