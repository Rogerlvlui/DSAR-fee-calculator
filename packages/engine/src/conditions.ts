// packages/engine/src/conditions.ts
//
// PRD §6.0 Condition evaluation — resolves each condition's `field` against
// the line first and the matter second, over the closed CONDITION_FIELDS
// vocabulary (@dsar/schemas/condition). Supports all three union arms
// (comparison, `in`, null-check) and all six comparison operators plus
// `in`/`isNull`/`isNotNull`. An empty condition array is met. Comparison is
// strict: no coercion between a string and a number, because a silently
// coerced comparison is a rule applying differently than a pack author
// wrote it. Returns the failing conditions themselves (not stringified
// descriptions) so the caller can render which ones failed without
// re-deriving them.
//
// RED (plan 02-04 Task 1): eq/neq below deliberately use `==`/`!=`
// (coercing) instead of `===`/`!==` (strict) — GREEN fixes this.

import { CONDITION_FIELDS, type Condition, type ConditionField } from "@dsar/schemas/condition";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { Matter } from "@dsar/schemas/matter";

export interface ConditionEvaluationContext {
  line: ExpenseLine;
  matter: Matter;
}

export interface EvaluateConditionsResult {
  met: boolean;
  failed: Condition[];
}

// Resolves a condition field's actual value. ExpenseLine and Matter fields
// in CONDITION_FIELDS never overlap by name, so checking the line first is
// unambiguous. The CONDITION_FIELDS membership check is defensive — the
// ConditionField type already closes this at compile time — so a field
// outside the vocabulary is unreachable via the type system, not a case
// this function is expected to actually hit at runtime.
function resolveFieldValue(field: ConditionField, context: ConditionEvaluationContext): unknown {
  if (!CONDITION_FIELDS.includes(field)) {
    throw new Error(`conditions: '${field}' is not in the closed CONDITION_FIELDS vocabulary`);
  }
  if (field in context.line) {
    return (context.line as unknown as Record<ConditionField, unknown>)[field];
  }
  return (context.matter as unknown as Record<ConditionField, unknown>)[field];
}

function compareOrdered(
  op: "gt" | "gte" | "lt" | "lte",
  expected: string | number | boolean,
  actual: unknown
): boolean {
  if (typeof expected !== typeof actual) return false;
  if (typeof expected === "number" && typeof actual === "number") {
    switch (op) {
      case "gt":
        return actual > expected;
      case "gte":
        return actual >= expected;
      case "lt":
        return actual < expected;
      case "lte":
        return actual <= expected;
    }
  }
  if (typeof expected === "string" && typeof actual === "string") {
    switch (op) {
      case "gt":
        return actual > expected;
      case "gte":
        return actual >= expected;
      case "lt":
        return actual < expected;
      case "lte":
        return actual <= expected;
    }
  }
  // Booleans (and any other unexpected pairing) have no ordering.
  return false;
}

function conditionHolds(condition: Condition, context: ConditionEvaluationContext): boolean {
  const actual = resolveFieldValue(condition.field, context);

  switch (condition.op) {
    case "isNull":
      return actual === null;
    case "isNotNull":
      return actual !== null;
    case "in":
      // eslint-disable-next-line eqeqeq -- RED: deliberately loose, see module note.
      return condition.value.some((candidate) => candidate == actual);
    case "eq":
      // eslint-disable-next-line eqeqeq -- RED: deliberately loose, see module note.
      return condition.value == actual;
    case "neq":
      // eslint-disable-next-line eqeqeq -- RED: deliberately loose, see module note.
      return condition.value != actual;
    case "gt":
    case "gte":
    case "lt":
    case "lte":
      return compareOrdered(condition.op, condition.value, actual);
  }
}

export function evaluateConditions(
  conditions: readonly Condition[],
  context: ConditionEvaluationContext
): EvaluateConditionsResult {
  const failed = conditions.filter((condition) => !conditionHolds(condition, context));
  return { met: failed.length === 0, failed };
}
