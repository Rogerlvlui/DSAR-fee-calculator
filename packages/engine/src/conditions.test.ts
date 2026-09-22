// packages/engine/src/conditions.test.ts
//
// Condition evaluation over the closed CONDITION_FIELDS vocabulary
// (@dsar/schemas/condition) — all three union arms (comparison, `in`,
// null-check), all six comparison operators, and strict (non-coercing)
// equality. Built against REFERENCE_MATTER/REFERENCE_LINE from plan
// 02-01's fixture so every test resolves real fields on real objects
// rather than ad hoc partials.

import { describe, expect, it } from "vitest";
import type { Condition } from "@dsar/schemas/condition";
import { evaluateConditions } from "./conditions.ts";
import { REFERENCE_LINE, REFERENCE_MATTER } from "./__fixtures__/reference-matter.ts";

// REFERENCE_LINE: categoryCode STAFF_TIME_SEARCH, quantity 4, unit HOUR,
// unitRate 4000, claimedAmount 16000, incurredByGrade EXECUTIVE,
// isThirdPartyInvoiced false, vendorName null, evidenceRef null.
// REFERENCE_MATTER: jurisdictionCode SG, controllerType PRIVATE_ORGANISATION,
// currency SGD, requestorClass FORMER_EMPLOYEE,
// isKnownDisputeOrLitigation true, isRepeatRequestWithin12Months false.

const context = { line: REFERENCE_LINE, matter: REFERENCE_MATTER };

describe("conditions — evaluateConditions", () => {
  it("an empty condition array is met, with nothing failed", () => {
    expect(evaluateConditions([], context)).toEqual({ met: true, failed: [] });
  });

  it("met: true when every condition holds", () => {
    const conditions: Condition[] = [
      { field: "quantity", op: "eq", value: 4 },
      { field: "unit", op: "eq", value: "HOUR" },
    ];
    expect(evaluateConditions(conditions, context)).toEqual({ met: true, failed: [] });
  });

  it("names each failing condition in `failed` when some do not hold", () => {
    const passing: Condition = { field: "quantity", op: "eq", value: 4 };
    const failing: Condition = { field: "unit", op: "eq", value: "PAGE" };
    const result = evaluateConditions([passing, failing], context);
    expect(result.met).toBe(false);
    expect(result.failed).toEqual([failing]);
  });

  describe("comparison arm — eq / neq", () => {
    it("eq matches an equal value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "eq", value: 4 }], context).met).toBe(true);
    });
    it("eq does not match an unequal value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "eq", value: 5 }], context).met).toBe(false);
    });
    it("neq matches an unequal value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "neq", value: 5 }], context).met).toBe(true);
    });
    it("neq does not match an equal value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "neq", value: 4 }], context).met).toBe(false);
    });
    it("is strict — a string value never equals a number field via coercion", () => {
      // REFERENCE_LINE.quantity is the number 4. A pack author writing the
      // string "4" must not match — no implicit coercion (per <action>).
      const condition: Condition = { field: "quantity", op: "eq", value: "4" as unknown as number };
      expect(evaluateConditions([condition], context).met).toBe(false);
    });
  });

  describe("comparison arm — gt / gte / lt / lte", () => {
    it("gt matches a strictly greater actual value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "gt", value: 3 }], context).met).toBe(true);
    });
    it("gt does not match an equal actual value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "gt", value: 4 }], context).met).toBe(false);
    });
    it("gte matches an equal actual value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "gte", value: 4 }], context).met).toBe(true);
    });
    it("gte does not match a strictly greater actual value on the wrong side", () => {
      expect(evaluateConditions([{ field: "quantity", op: "gte", value: 5 }], context).met).toBe(false);
    });
    it("lt matches a strictly smaller actual value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "lt", value: 5 }], context).met).toBe(true);
    });
    it("lt does not match an equal actual value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "lt", value: 4 }], context).met).toBe(false);
    });
    it("lte matches an equal actual value", () => {
      expect(evaluateConditions([{ field: "quantity", op: "lte", value: 4 }], context).met).toBe(true);
    });
    it("lte does not match a strictly smaller comparator", () => {
      expect(evaluateConditions([{ field: "quantity", op: "lte", value: 3 }], context).met).toBe(false);
    });
  });

  describe("`in` arm", () => {
    it("matches when the actual value is a member of the list", () => {
      const condition: Condition = { field: "unit", op: "in", value: ["HOUR", "PAGE"] };
      expect(evaluateConditions([condition], context).met).toBe(true);
    });
    it("does not match when the actual value is absent from the list", () => {
      const condition: Condition = { field: "unit", op: "in", value: ["PAGE", "ITEM"] };
      expect(evaluateConditions([condition], context).met).toBe(false);
    });
    it("an empty list never matches", () => {
      const condition: Condition = { field: "unit", op: "in", value: [] };
      expect(evaluateConditions([condition], context).met).toBe(false);
    });
  });

  describe("null-check arm — isNull / isNotNull", () => {
    it("isNull matches a null field", () => {
      const condition: Condition = { field: "vendorName", op: "isNull" };
      expect(evaluateConditions([condition], context).met).toBe(true);
    });
    it("isNull does not match a populated field", () => {
      const condition: Condition = { field: "incurredByGrade", op: "isNull" };
      expect(evaluateConditions([condition], context).met).toBe(false);
    });
    it("isNotNull matches a populated field", () => {
      const condition: Condition = { field: "incurredByGrade", op: "isNotNull" };
      expect(evaluateConditions([condition], context).met).toBe(true);
    });
    it("isNotNull does not match a null field", () => {
      const condition: Condition = { field: "evidenceRef", op: "isNotNull" };
      expect(evaluateConditions([condition], context).met).toBe(false);
    });
  });

  describe("matter-side fields", () => {
    it("resolves a Matter field, not only an ExpenseLine field", () => {
      const condition: Condition = { field: "isKnownDisputeOrLitigation", op: "eq", value: true };
      expect(evaluateConditions([condition], context).met).toBe(true);
    });
    it("fails against a Matter field when the value does not match", () => {
      const condition: Condition = { field: "isRepeatRequestWithin12Months", op: "eq", value: true };
      expect(evaluateConditions([condition], context).met).toBe(false);
    });
  });
});
