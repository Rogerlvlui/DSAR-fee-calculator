// packages/schemas/src/condition.ts
//
// PRD §6.0 Condition — "Machine-evaluable only. No free-text predicates, no
// expressions to eval."
//
// zod cannot express `keyof SomeType` as a runtime schema — `keyof` is a
// compile-time-only construct (01-RESEARCH.md, Architecture Patterns,
// Pattern 2; CONTEXT.md "Claude's Discretion"). CONDITION_FIELDS is a
// literal, TypeScript-checked union of the specific field names a condition
// may reference, closed at both ends:
//   - at compile time, by the `satisfies readonly (keyof ExpenseLine |
//     keyof Matter)[]` clause below — listing a name that does not exist on
//     either type is a compile error;
//   - at runtime, by `ConditionFieldSchema`, a zod enum over the same list —
//     a pack carrying a field name outside this set fails to parse.
//
// The rejected alternative: loosening `Condition.field` to `string`. That
// was considered and rejected because it defeats the entire point of
// "machine-evaluable only, no free-text predicates" (PRD §6.0) — a
// free-text field name is one step away from a free-text expression, and an
// expression is exactly what this schema exists to make impossible. Do not
// widen this to `z.string()`.

import { z } from "zod";
import type { ExpenseLine } from "./expense-line.ts";
import type { Matter } from "./matter.ts";

export const CONDITION_FIELDS = [
  // ExpenseLine fields conditions may reference
  "categoryCode",
  "quantity",
  "unit",
  "unitRate",
  "claimedAmount",
  "incurredByGrade",
  "isThirdPartyInvoiced",
  "vendorName",
  "evidenceRef",
  // Matter fields conditions may reference
  "jurisdictionCode",
  "controllerType",
  "currency",
  "requestorClass",
  "isKnownDisputeOrLitigation",
  "isRepeatRequestWithin12Months",
] as const satisfies readonly (keyof ExpenseLine | keyof Matter)[];

export type ConditionField = (typeof CONDITION_FIELDS)[number];
export const ConditionFieldSchema = z.enum(CONDITION_FIELDS);

const ComparisonOpSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte"]);

// Three-arm union, matching PRD §6.0's Condition type exactly:
//   - comparison arm: op is one of the six comparison operators, value is a
//     string, number, or boolean
//   - in arm: op is 'in', value is an array of string or number (an empty
//     array parses — a condition that can never match is a pack-authoring
//     concern, not a schema error)
//   - null-check arm: op is 'isNull' or 'isNotNull', and carries no `value`
//     key at all — z.strictObject() rejects a stray one
export const ConditionSchema = z.union([
  z.strictObject({
    field: ConditionFieldSchema,
    op: ComparisonOpSchema,
    value: z.union([z.string(), z.number(), z.boolean()]),
  }),
  z.strictObject({
    field: ConditionFieldSchema,
    op: z.literal("in"),
    value: z.array(z.union([z.string(), z.number()])),
  }),
  z.strictObject({
    field: ConditionFieldSchema,
    op: z.enum(["isNull", "isNotNull"]),
  }),
]);

export type Condition = z.infer<typeof ConditionSchema>;
