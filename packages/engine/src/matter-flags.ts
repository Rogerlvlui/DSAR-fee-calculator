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
import type { MatterFlag } from "@dsar/schemas/primitives";
import { evaluateConditions } from "./conditions.ts";

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
