// packages/rulepacks/src/validate.ts
//
// The build-time gate: one check per requirement, first violation throws.
// 03-01 (T-03-02) implemented the PACK-11 banned-word scan, which runs for
// every pack regardless of status. This plan (03-03) adds PACK-02
// (categoryRules exhaustiveness) and PACK-03 (ACTIVE-readiness — reviewer
// identity, review-date coherence, no unauthored content, no unresearched
// constraint) — both gates a pack must clear before `status: "ACTIVE"` is a
// checked fact rather than an unverified claim (PRD §7.3, AC-38).
//
// `findBannedWord` is transcribed VERBATIM from
// packages/engine/src/engine-language.test.ts — case-sensitive, word-
// boundary anchored, over the SAME `LEGAL_CONCLUSION_BANNED_WORDS` list.
// CONTEXT.md records that a case-insensitive matcher was empirically shown
// to break 6 of 21 legitimate message templates using "Legal" as the
// department's proper noun — do not author a second list or a second,
// case-insensitive matcher.

import { LEGAL_CONCLUSION_BANNED_WORDS, UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import { RulePackSchema, type LoadableRulePack, type RulePack } from "@dsar/schemas/rule-pack";
import { EXPENSE_CATEGORY_CODES, type ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import { loadAllRulePacks, RULEPACKS_ROOT } from "./loader.ts";

export type RulePackValidationCode =
  | "BANNED_WORD_IN_BASIS"
  | "MISSING_CATEGORY_RULES"
  | "DUPLICATE_CATEGORY_RULE"
  | "MISSING_REVIEWER"
  | "REVIEW_DUE_BEFORE_REVIEWED"
  | "UNAUTHORED_CONTENT"
  | "UNRESEARCHED_CONSTRAINTS";

export class RulePackValidationFailure extends Error {
  readonly code: RulePackValidationCode;
  readonly packId: string;
  // Not declared with a `?` optional modifier: under this project's
  // `exactOptionalPropertyTypes`, an optional property may never be
  // explicitly assigned `undefined` (only omitted entirely) — but the
  // constructor always assigns this field, so its type must include
  // `undefined` explicitly instead.
  readonly ruleId: string | undefined;

  constructor(
    code: RulePackValidationCode,
    packId: string,
    message: string,
    ruleId?: string
  ) {
    super(message);
    this.name = "RulePackValidationFailure";
    this.code = code;
    this.packId = packId;
    this.ruleId = ruleId;
  }
}

// Verbatim from packages/engine/src/engine-language.test.ts (PACK-11 reuse —
// same list, same matcher, no second copy).
export function findBannedWord(text: string): string | null {
  for (const word of LEGAL_CONCLUSION_BANNED_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`); // case-sensitive by default, word-boundary anchored
    if (pattern.test(text)) return word;
  }
  return null;
}

// PACK-11: every categoryRules[].basis, plus flatFee.basis where present, is
// scanned. First match throws — no partial success, matching
// packages/engine/src/preconditions.ts's established pattern.
export function validateRulePack(pack: LoadableRulePack): void {
  for (const rule of pack.categoryRules) {
    const match = findBannedWord(rule.basis);
    if (match) {
      throw new RulePackValidationFailure(
        "BANNED_WORD_IN_BASIS",
        pack.packId,
        `Pack "${pack.packId}" rule "${rule.ruleId}" basis contains banned word "${match}"`,
        rule.ruleId
      );
    }
  }

  if (pack.flatFee) {
    const match = findBannedWord(pack.flatFee.basis);
    if (match) {
      throw new RulePackValidationFailure(
        "BANNED_WORD_IN_BASIS",
        pack.packId,
        `Pack "${pack.packId}" flatFee basis contains banned word "${match}"`
      );
    }
  }

  // PACK-02/PACK-03: the ACTIVE-readiness gates below apply only to a pack
  // that claims ACTIVE — a DRAFT stub (e.g. every committed pack today,
  // D-16) must still parse and load, per RulePackSchema's own module note
  // that a DRAFT stub must still parse. `assertActiveReady`'s result is
  // discarded here; `validateRulePack` stays void-returning (PACK-11's
  // existing contract), and the narrowed `RulePack` is for a caller that
  // specifically wants the ACTIVE-ready value (e.g. the engine boundary).
  if (pack.status === "ACTIVE") {
    assertActiveReady(pack);
  }
}

// ---------------------------------------------------------------------------
// PACK-02 — categoryRules exhaustiveness (ACTIVE precondition)
// ---------------------------------------------------------------------------

// Every one of the 21 codes, exactly once. Counting (not `new
// Set(codes).size === 21`) is deliberate: a complete-but-duplicated pack —
// 21 distinct codes present, one of them doubled — passes a naive set-size
// check and must still fail here.
function assertCategoryRulesExhaustive(pack: LoadableRulePack): void {
  const counts = new Map<ExpenseCategoryCode, number>();
  for (const code of EXPENSE_CATEGORY_CODES) counts.set(code, 0);
  for (const rule of pack.categoryRules) {
    counts.set(rule.categoryCode, (counts.get(rule.categoryCode) ?? 0) + 1);
  }

  // Filtering over EXPENSE_CATEGORY_CODES (not over the pack's own
  // categoryRules order) is what makes the reported list order-independent
  // of file order — the same incomplete pack always reports the same
  // missing-code list, in the taxonomy's own declaration order.
  const missing = EXPENSE_CATEGORY_CODES.filter((code) => (counts.get(code) ?? 0) === 0);
  if (missing.length > 0) {
    throw new RulePackValidationFailure(
      "MISSING_CATEGORY_RULES",
      pack.packId,
      `Pack "${pack.packId}" is ACTIVE but missing categoryRules for: ${missing.join(", ")}`
    );
  }

  const duplicated = EXPENSE_CATEGORY_CODES.filter((code) => (counts.get(code) ?? 0) > 1);
  if (duplicated.length > 0) {
    throw new RulePackValidationFailure(
      "DUPLICATE_CATEGORY_RULE",
      pack.packId,
      `Pack "${pack.packId}" is ACTIVE but has duplicate categoryRules for: ${duplicated.join(", ")}`
    );
  }
}

// ---------------------------------------------------------------------------
// PACK-03 — ACTIVE-readiness (reviewer identity, review-date coherence,
// no unauthored content, no unresearched constraint)
// ---------------------------------------------------------------------------

// Reviewer identity: `reviewDueOn` is non-nullable in the frozen schema
// already, so it needs no presence check here — only the coherence check
// below. Order matters: this is the order the first-failure-wins message
// names, per ACTIVE_READY_CHECK_ORDER.
function assertReviewerIdentity(pack: LoadableRulePack): void {
  const REQUIRED_REVIEWER_FIELDS = ["authoredBy", "reviewedBy", "reviewedOn"] as const;
  for (const field of REQUIRED_REVIEWER_FIELDS) {
    if (pack[field] === null) {
      throw new RulePackValidationFailure(
        "MISSING_REVIEWER",
        pack.packId,
        `Pack "${pack.packId}" is ACTIVE but missing required reviewer field "${field}"`
      );
    }
  }
}

// `reviewDueOn` must not be earlier than `reviewedOn`. Both are `z.iso.date()`
// — "YYYY-MM-DD" — so lexicographic string comparison is correct calendar
// comparison and needs no date library. Equal dates pass (inclusive
// boundary); only strictly-earlier fails. `reviewedOn` is guaranteed
// non-null here because assertReviewerIdentity (declared earlier in
// ACTIVE_READY_CHECK_ORDER) already refused a null one.
function assertReviewDateCoherence(pack: LoadableRulePack): void {
  if (pack.reviewedOn !== null && pack.reviewDueOn < pack.reviewedOn) {
    throw new RulePackValidationFailure(
      "REVIEW_DUE_BEFORE_REVIEWED",
      pack.packId,
      `Pack "${pack.packId}" reviewDueOn (${pack.reviewDueOn}) is before reviewedOn (${pack.reviewedOn})`
    );
  }
}

// D-15: the UNAUTHORED_TOKEN marker, scanned across every authored text
// channel. First match throws, naming the ruleId or field it was found in.
//
// NOTE: `flatFee.verificationNote` is NOT scanned here. `FlatFeeSchema`
// (packages/schemas/src/rule-pack.ts) does not yet carry a `verificationNote`
// field — D-22's flat-fee UNAUTHORED-token channel is scheduled to land in
// plan 03-05 alongside the HK-PDPO pack that is this schema's only consumer.
// When that field lands, add a `pack.flatFee?.verificationNote` check here,
// in the same declared order, rather than a second token scan.
function assertNoUnauthoredContent(pack: LoadableRulePack): void {
  for (const rule of pack.categoryRules) {
    if (rule.verificationNote !== null && rule.verificationNote.startsWith(UNAUTHORED_TOKEN)) {
      throw new RulePackValidationFailure(
        "UNAUTHORED_CONTENT",
        pack.packId,
        `Pack "${pack.packId}" categoryRule "${rule.ruleId}" verificationNote still carries the ${UNAUTHORED_TOKEN} token`,
        rule.ruleId
      );
    }
  }

  if (pack.requestorNoticeTemplate.startsWith(UNAUTHORED_TOKEN)) {
    throw new RulePackValidationFailure(
      "UNAUTHORED_CONTENT",
      pack.packId,
      `Pack "${pack.packId}" requestorNoticeTemplate still carries the ${UNAUTHORED_TOKEN} token`
    );
  }
}

// D-18/PD-2: finishing by re-parsing with the frozen, untouched
// `RulePackSchema` is what refuses a pack carrying any unresearched `null`
// constraint — because `RulePackConstraintsSchema` is all-boolean/non-null
// where `StubConstraintsSchema` is all-nullable, re-parsing IS the
// eleven-key check, with no second hand-written list to drift from it
// (CONTEXT.md records that Phase 1 lost four gates to exactly that failure
// mode). The zod message is passed through so the author sees which key.
function assertNoUnresearchedConstraints(pack: LoadableRulePack): void {
  const result = RulePackSchema.safeParse(pack);
  if (!result.success) {
    throw new RulePackValidationFailure(
      "UNRESEARCHED_CONSTRAINTS",
      pack.packId,
      `Pack "${pack.packId}" failed ACTIVE-readiness narrowing: ${result.error.message}`
    );
  }
}

// The declared check order — a module-level constant, not the incidental
// order of a sequence of if-statements, following the
// DERIVED_MATTER_FLAG_SPECS precedent (packages/engine/src/matter-flags.ts)
// so a silent reordering fails a literal-array test rather than quietly
// changing which message a pack failing two checks at once reports.
const ACTIVE_READY_CHECKS: readonly {
  name: string;
  run: (pack: LoadableRulePack) => void;
}[] = [
  { name: "CATEGORY_RULES_EXHAUSTIVENESS", run: assertCategoryRulesExhaustive },
  { name: "REVIEWER_IDENTITY", run: assertReviewerIdentity },
  { name: "REVIEW_DATE_COHERENCE", run: assertReviewDateCoherence },
  { name: "UNAUTHORED_CONTENT", run: assertNoUnauthoredContent },
  { name: "UNRESEARCHED_CONSTRAINTS", run: assertNoUnresearchedConstraints },
];

// Exposed so a test can assert the declared order directly against a
// literal array, rather than only inferring it from produced error codes.
export const ACTIVE_READY_CHECK_ORDER: readonly string[] = ACTIVE_READY_CHECKS.map(
  (check) => check.name
);

// The single entry point for every ACTIVE precondition (PACK-02, PACK-03).
// Runs each check in ACTIVE_READY_CHECK_ORDER; first failure wins, so the
// same pack always yields the same message across runs and machines. On
// success, returns the narrowed `RulePack` the engine can consume — the
// only sanctioned way a `LoadableRulePack` becomes a `RulePack`.
export function assertActiveReady(pack: LoadableRulePack): RulePack {
  for (const check of ACTIVE_READY_CHECKS) {
    check.run(pack);
  }
  return RulePackSchema.parse(pack);
}

export function validateAllRulePacks(root: string = RULEPACKS_ROOT): void {
  const packs = loadAllRulePacks(root);
  for (const pack of packs) {
    validateRulePack(pack);
  }
}
