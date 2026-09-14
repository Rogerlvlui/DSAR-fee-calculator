// packages/schemas/src/condition.test.ts
//
// Falsifies ConditionSchema: the closed field enum (compile-time and
// runtime), the three-arm union shape (comparison / in / null-check), the
// `in` operator's array-only value, the null-check arms' absence of a
// `value` key, and the six-member comparison-operator enum.

import { describe, expect, it } from "vitest";
import { CONDITION_FIELDS, ConditionFieldSchema, ConditionSchema } from "./condition.ts";
import type { ExpenseLine } from "./expense-line.ts";
import type { Matter } from "./matter.ts";

describe("CONDITION_FIELDS", () => {
  it("has exactly 15 entries", () => {
    expect(CONDITION_FIELDS.length).toBe(15);
  });

  it("every entry parses via ConditionFieldSchema", () => {
    for (const field of CONDITION_FIELDS) {
      expect(ConditionFieldSchema.safeParse(field).success).toBe(true);
    }
  });

  it("rejects a field name outside the closed set at runtime", () => {
    expect(ConditionFieldSchema.safeParse("notAPermittedField").success).toBe(false);
  });
});

describe("ConditionSchema — comparison arm", () => {
  it("parses a condition naming a permitted field with a comparison operator", () => {
    const result = ConditionSchema.safeParse({
      field: "unit",
      op: "eq",
      value: "PAGE",
    });
    expect(result.success).toBe(true);
  });

  it("fails for a field that exists on neither ExpenseLine nor Matter", () => {
    const result = ConditionSchema.safeParse({
      field: "notAPermittedField",
      op: "eq",
      value: "PAGE",
    });
    expect(result.success).toBe(false);
  });

  it("fails for a comparison operator outside the six declared ones", () => {
    const result = ConditionSchema.safeParse({
      field: "unit",
      op: "matches",
      value: "PAGE",
    });
    expect(result.success).toBe(false);
  });

  it("accepts each of the six declared comparison operators", () => {
    for (const op of ["eq", "neq", "gt", "gte", "lt", "lte"] as const) {
      const result = ConditionSchema.safeParse({ field: "quantity", op, value: 1 });
      expect(result.success).toBe(true);
    }
  });

  it("accepts a string, number, or boolean value", () => {
    expect(ConditionSchema.safeParse({ field: "unit", op: "eq", value: "PAGE" }).success).toBe(
      true
    );
    expect(ConditionSchema.safeParse({ field: "quantity", op: "gt", value: 1 }).success).toBe(
      true
    );
    expect(
      ConditionSchema.safeParse({ field: "isThirdPartyInvoiced", op: "eq", value: true }).success
    ).toBe(true);
  });
});

describe("ConditionSchema — in arm", () => {
  it("requires an array value; a scalar value fails", () => {
    const result = ConditionSchema.safeParse({
      field: "unit",
      op: "in",
      value: "PAGE",
    });
    expect(result.success).toBe(false);
  });

  it("parses an array of strings or numbers", () => {
    expect(
      ConditionSchema.safeParse({ field: "unit", op: "in", value: ["PAGE", "ITEM"] }).success
    ).toBe(true);
    expect(
      ConditionSchema.safeParse({ field: "quantity", op: "in", value: [1, 2, 3] }).success
    ).toBe(true);
  });

  it("parses an empty in array — a condition that can never match is a pack-authoring concern", () => {
    const result = ConditionSchema.safeParse({ field: "unit", op: "in", value: [] });
    expect(result.success).toBe(true);
  });
});

describe("ConditionSchema — null-check arm", () => {
  it("parses isNull and isNotNull with no value key", () => {
    expect(ConditionSchema.safeParse({ field: "evidenceRef", op: "isNull" }).success).toBe(true);
    expect(ConditionSchema.safeParse({ field: "evidenceRef", op: "isNotNull" }).success).toBe(
      true
    );
  });

  it("rejects a null-check arm carrying a value key", () => {
    const result = ConditionSchema.safeParse({
      field: "evidenceRef",
      op: "isNull",
      value: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("ConditionSchema — union arity", () => {
  it("is a union of exactly 3 arms", () => {
    // ConditionSchema is a ZodUnion; its options array is the arm list.
    const options = (ConditionSchema as unknown as { options: unknown[] }).options;
    expect(options.length).toBe(3);
  });
});

// Compile-time closure: adding a field name that does not exist on either
// ExpenseLine or Matter must fail to compile. This is the loop the plan's
// `satisfies readonly (keyof ExpenseLine | keyof Matter)[]` clause closes —
// see condition.ts.
// @ts-expect-error — "totallyMadeUpField" is not a key of ExpenseLine or Matter
const _badConditionFields = ["totallyMadeUpField"] as const satisfies readonly (
  | keyof ExpenseLine
  | keyof Matter
)[];
void _badConditionFields;
