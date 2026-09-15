// packages/engine/src/matter-flags.ts
//
// PRD §8.1 step 7 — matter-level flags (ENGINE-11). Two families:
//   - Task 1 (this file, evaluatePackFlagRules): the pack's own authored
//     matterFlagRules, evaluated across all three `when` arms.
//   - Task 2 (computeDerivedMatterFlags, composeMatterLevelFlags): the four
//     derived codes (LITIGATION_POSTURE, REPEAT_REQUEST, STALE_PACK_WARNING,
//     NO_FEE_AUTHORITY_POSTURE) and the final array composition assess.ts
//     writes into Assessment.matterLevelFlags.
//
// A pack-authored legal warning that silently fails to fire is a warning
// nobody sees (threat T-2-23) — an unrecognised `when` shape throws rather
// than being skipped.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { MatterFlagRule, RulePack } from "@dsar/schemas/rule-pack";
import { CONDITION_FIELDS, type Condition, type ConditionField } from "@dsar/schemas/condition";
import type { MatterFlag, MatterFlagCode } from "@dsar/schemas/primitives";
import { evaluateConditions } from "./conditions.ts";
import { daysUntil } from "./calendar-math.ts";
import {
  litigationPostureMessage,
  noFeeAuthorityPostureMessage,
  repeatRequestMessage,
  stalePackWarningMessage,
} from "./messages.ts";

// Matter-only fields from the closed CONDITION_FIELDS vocabulary
// (condition.ts's own comment already splits the list this way). Used to
// decide whether a condition-arm matterFlagRule is evaluated once against
// the matter, or against each line in turn.
const MATTER_CONDITION_FIELDS: readonly ConditionField[] = [
  "jurisdictionCode",
  "controllerType",
  "currency",
  "requestorClass",
  "isKnownDisputeOrLitigation",
  "isRepeatRequestWithin12Months",
];

function isMatterField(field: ConditionField): boolean {
  return (MATTER_CONDITION_FIELDS as readonly string[]).includes(field);
}

type AlwaysArm = { always: true };
type LineCountArm = { field: "lineCount"; op: "gte" | "lte"; value: number };

function isAlwaysArm(when: MatterFlagRule["when"]): when is AlwaysArm {
  return typeof when === "object" && when !== null && "always" in when;
}

function isLineCountArm(when: MatterFlagRule["when"]): when is LineCountArm {
  return (
    typeof when === "object" &&
    when !== null &&
    "field" in when &&
    (when as { field?: unknown }).field === "lineCount"
  );
}

function isConditionArm(when: MatterFlagRule["when"]): when is Condition {
  return (
    typeof when === "object" &&
    when !== null &&
    "field" in when &&
    (when as { field?: unknown }).field !== "lineCount" &&
    CONDITION_FIELDS.includes((when as { field?: ConditionField }).field as ConditionField)
  );
}

// Reuses evaluateConditions() (conditions.ts) rather than a second
// evaluator — the closed field vocabulary and comparison semantics must be
// identical to the ones category rules use, or a pack author writing the
// same predicate in two places gets two different answers.
//
// A matter-field condition never reads anything off `line` —
// conditions.ts's resolveFieldValue() falls through to `context.matter`
// whenever the field is absent from `context.line`, and no matter field
// name ever collides with an ExpenseLine key — so a placeholder satisfies
// the call signature without ever being read. This lets the matter-field
// branch run correctly even when `lines` is empty, matching "evaluate a
// matter-field condition once against the matter" regardless of how many
// expense lines the matter has.
const PLACEHOLDER_LINE = {} as unknown as ExpenseLine;

function conditionArmMatches(condition: Condition, matter: Matter, lines: readonly ExpenseLine[]): boolean {
  if (isMatterField(condition.field)) {
    return evaluateConditions([condition], { line: PLACEHOLDER_LINE, matter }).met;
  }
  // Line-field condition: fires if ANY line matches, not every line — a
  // decision recorded here because "every line" would make most such rules
  // effectively unfirable (PRD §7.5/§7.6's own matterFlagRules are written
  // against a single offending line, not the whole set).
  return lines.some((line) => evaluateConditions([condition], { line, matter }).met);
}

function evaluateLineCountArm(when: LineCountArm, lines: readonly ExpenseLine[]): boolean {
  // Inclusive at the boundary for both operators — a rule authored as
  // `gte 3` fires on exactly 3 lines, and `lte 2` fires on exactly 2.
  return when.op === "gte" ? lines.length >= when.value : lines.length <= when.value;
}

function evaluateWhen(when: MatterFlagRule["when"], matter: Matter, lines: readonly ExpenseLine[]): boolean {
  if (isAlwaysArm(when)) {
    return when.always;
  }
  if (isLineCountArm(when)) {
    return evaluateLineCountArm(when, lines);
  }
  if (isConditionArm(when)) {
    return conditionArmMatches(when, matter, lines);
  }
  // Exhaustive discrimination over MatterFlagRuleSchema's three `when`
  // arms — an unrecognised shape throws rather than silently producing no
  // flag (threat T-2-23).
  throw new Error(`matter-flags: unrecognised matterFlagRule 'when' shape: ${JSON.stringify(when)}`);
}

// §8.1 step 7 (first half) / ENGINE-11 — evaluates every matterFlagRule the
// pack authors against the matter and its lines, in the order the rules
// appear in the pack. A pack with no rules returns an empty array and never
// throws.
export function evaluatePackFlagRules(
  pack: RulePack,
  matter: Matter,
  lines: readonly ExpenseLine[]
): MatterFlag[] {
  const flags: MatterFlag[] = [];
  for (const rule of pack.matterFlagRules) {
    if (evaluateWhen(rule.when, matter, lines)) {
      flags.push({
        id: rule.flagId,
        code: "PACK_FLAG",
        message: rule.message,
        requiresAcknowledgement: rule.requiresAcknowledgement,
      });
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Task 2 — the four derived matter-flag codes (§8.1 step 7, ENGINE-11)
// ---------------------------------------------------------------------------

type DerivedMatterFlagCode =
  | "LITIGATION_POSTURE"
  | "REPEAT_REQUEST"
  | "STALE_PACK_WARNING"
  | "NO_FEE_AUTHORITY_POSTURE";

interface DerivedFlagSpec {
  code: DerivedMatterFlagCode;
  requiresAcknowledgement: boolean;
  fires: (matter: Matter, pack: RulePack, now: string) => boolean;
  message: (matter: Matter, pack: RulePack, now: string) => string;
}

// The declared order every derived flag is evaluated and, if it fires,
// appended in — a fixed constant rather than the incidental order of a
// series of `if` statements, so this array is reviewable on its own and a
// golden-file `toEqual` over the produced array is stable (T-2-27). PRD
// §8.1 step 7's own prose order (LITIGATION_POSTURE, REPEAT_REQUEST,
// STALE_PACK_WARNING) is preserved; NO_FEE_AUTHORITY_POSTURE — not named in
// step 7's prose but a real MatterFlagCode member (PRD §6.0) — is appended
// last.
const DERIVED_MATTER_FLAG_SPECS: readonly DerivedFlagSpec[] = [
  {
    code: "LITIGATION_POSTURE",
    // AC-24: requires acknowledgement.
    requiresAcknowledgement: true,
    fires: (matter) => matter.isKnownDisputeOrLitigation,
    message: () => litigationPostureMessage(),
  },
  {
    code: "REPEAT_REQUEST",
    // AC-24: informational — does not block sign-off.
    requiresAcknowledgement: false,
    fires: (matter) => matter.isRepeatRequestWithin12Months,
    message: () => repeatRequestMessage(),
  },
  {
    code: "STALE_PACK_WARNING",
    // AC-24: requires acknowledgement.
    requiresAcknowledgement: true,
    // §9.3: "within 30 days of reviewDueOn" — inclusive of day 30. A
    // negative result (past due) cannot occur here: plan 02-01's
    // checkPreconditions() already refuses a past-due pack outright before
    // assess() ever reaches step 7 (AC-39, §9.3's "a block, not a banner")
    // — do not add a redundant `>= 0` guard on the strength of that.
    // RED (deliberate, Task 2 red phase): off-by-one — <= 31 instead of the
    // inclusive-of-30 window §9.3 specifies, so a pack due in 31 days
    // incorrectly fires this flag.
    fires: (_matter, pack, now) => daysUntil(now, pack.reviewDueOn) <= 31,
    message: (_matter, pack, now) => stalePackWarningMessage(pack.reviewDueOn, daysUntil(now, pack.reviewDueOn)),
  },
  {
    code: "NO_FEE_AUTHORITY_POSTURE",
    // AC-24: informational at matter level — the per-line NO_FEE_AUTHORITY
    // FlagReason is what actually blocks each line's amount; this is the
    // once-per-matter statement of the same fact (see messages.ts's note).
    requiresAcknowledgement: false,
    fires: (matter, pack) => pack.feePosture[matter.controllerType] === "NO_EXPRESS_AUTHORITY",
    message: () => noFeeAuthorityPostureMessage(),
  },
];

// Exposed so a test can assert the declared order directly, rather than
// only inferring it from a produced array — the order itself is what T-2-27
// exists to keep stable.
export const DERIVED_MATTER_FLAG_ORDER: readonly MatterFlagCode[] = DERIVED_MATTER_FLAG_SPECS.map(
  (spec) => spec.code
);

// §8.1 step 7 (second half) / ENGINE-11 — the four derived matter-flag
// codes, in DERIVED_MATTER_FLAG_SPECS's declared order. Each derived flag's
// `id` is its own code: unlike a pack-authored flag (whose id is the pack's
// own `flagId`), a derived flag has no pack-authored identity to carry, and
// the code itself is already a stable, unique string.
export function computeDerivedMatterFlags(matter: Matter, pack: RulePack, now: string): MatterFlag[] {
  return DERIVED_MATTER_FLAG_SPECS.filter((spec) => spec.fires(matter, pack, now)).map((spec) => ({
    id: spec.code,
    code: spec.code,
    message: spec.message(matter, pack, now),
    requiresAcknowledgement: spec.requiresAcknowledgement,
  }));
}

export interface ComposeMatterLevelFlagsInput {
  derivedFlags: readonly MatterFlag[];
  aggregateCapFlag: MatterFlag | null;
  packFlags: readonly MatterFlag[];
}

// §8.1 step 7's final array composition and ordering, owned in exactly one
// place: derived flags (DERIVED_MATTER_FLAG_SPECS's declared order) first,
// then plan 02-05's aggregate-cap flag if it fired, then the pack's own
// matterFlagRules in the order they appear in the pack. PRD §14's expected
// five flags (the two derived ones, then the three SG pack flags) match
// this order exactly.
export function composeMatterLevelFlags(input: ComposeMatterLevelFlagsInput): MatterFlag[] {
  const { derivedFlags, aggregateCapFlag, packFlags } = input;
  return [...derivedFlags, ...(aggregateCapFlag ? [aggregateCapFlag] : []), ...packFlags];
}
