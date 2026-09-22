// packages/schemas/src/expense-line.test.ts
//
// Falsifies ExpenseLineSchema: the claimedAmount = quantity * unitRate
// invariant (AC-08), the quantity > 0 constraint, the two free-text caps,
// the closed ExpenseUnit and ExpenseCategoryCode enums, and the nullable
// fields.

import { describe, expect, it } from "vitest";
import { EXPENSE_LINE_QUANTITY_MAX, ExpenseLineSchema, ExpenseUnitSchema } from "./expense-line.ts";
import { MatterSchema } from "./matter.ts";

function validLine() {
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    matterId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    seq: 0,
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Photocopying the response bundle",
    quantity: 5,
    unit: "PAGE",
    unitRate: 10,
    claimedAmount: 50,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  };
}

describe("ExpenseLineSchema", () => {
  it("parses a line where claimedAmount equals quantity * unitRate", () => {
    expect(ExpenseLineSchema.safeParse(validLine()).success).toBe(true);
  });

  it("fails when claimedAmount does not equal quantity * unitRate, with path ['claimedAmount']", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), claimedAmount: 51 });
    expect(result.success).toBe(false);
    if (!result.success) {
      const hasPath = result.error.issues.some(
        (i) => i.path.length === 1 && i.path[0] === "claimedAmount"
      );
      expect(hasPath).toBe(true);
    }
  });

  it("fails when quantity is zero", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), quantity: 0, claimedAmount: 0 });
    expect(result.success).toBe(false);
  });

  it("fails when quantity is negative", () => {
    const result = ExpenseLineSchema.safeParse({
      ...validLine(),
      quantity: -1,
      claimedAmount: -10,
    });
    expect(result.success).toBe(false);
  });

  it("accepts description of 300 characters", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), description: "a".repeat(300) });
    expect(result.success).toBe(true);
  });

  it("rejects description of 301 characters", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), description: "a".repeat(301) });
    expect(result.success).toBe(false);
  });

  it("accepts hrNote of 500 characters", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), hrNote: "a".repeat(500) });
    expect(result.success).toBe(true);
  });

  it("rejects hrNote of 501 characters", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), hrNote: "a".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("accepts hrNote of null", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), hrNote: null });
    expect(result.success).toBe(true);
  });

  it.each(["HOUR", "PAGE", "ITEM", "GIGABYTE", "FIXED"])("accepts unit %s", (unit) => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), unit });
    expect(result.success).toBe(true);
  });

  it("rejects a unit outside the five declared values", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), unit: "KILOGRAM" });
    expect(result.success).toBe(false);
  });

  it("accepts categoryCode OTHER_UNCLASSIFIED", () => {
    const result = ExpenseLineSchema.safeParse({
      ...validLine(),
      categoryCode: "OTHER_UNCLASSIFIED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a categoryCode outside the 21-code taxonomy", () => {
    const result = ExpenseLineSchema.safeParse({ ...validLine(), categoryCode: "NOT_A_CODE" });
    expect(result.success).toBe(false);
  });

  it("accepts incurredByGrade, vendorName and evidenceRef as null", () => {
    const result = ExpenseLineSchema.safeParse({
      ...validLine(),
      incurredByGrade: null,
      vendorName: null,
      evidenceRef: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts quantity at EXPENSE_LINE_QUANTITY_MAX", () => {
    const result = ExpenseLineSchema.safeParse({
      ...validLine(),
      quantity: EXPENSE_LINE_QUANTITY_MAX,
      unitRate: 0,
      claimedAmount: 0,
    });
    expect(result.success).toBe(true);
  });

  // WR-03: a data-entry typo like quantity 50,000,000 must be rejected here,
  // at the schema boundary, rather than silently passing zod (well within
  // Number.MAX_SAFE_INTEGER) and only failing later at the Prisma write when
  // quantity * unitRate overflows the Int32 column.
  it("rejects quantity one past EXPENSE_LINE_QUANTITY_MAX", () => {
    const result = ExpenseLineSchema.safeParse({
      ...validLine(),
      quantity: EXPENSE_LINE_QUANTITY_MAX + 1,
      unitRate: 0,
      claimedAmount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("parses when quantity * unitRate is exactly 0 and claimedAmount is also 0", () => {
    const result = ExpenseLineSchema.safeParse({
      ...validLine(),
      quantity: 1,
      unitRate: 0,
      claimedAmount: 0,
    });
    expect(result.success).toBe(true);
  });
});

describe("ExpenseUnitSchema", () => {
  it("has exactly 5 members", () => {
    expect(ExpenseUnitSchema.options.length).toBe(5);
  });
});

describe("SCHEMA-01 adjacency edge (reverse direction)", () => {
  it("fails to parse a Matter-shaped object against ExpenseLineSchema", () => {
    const matter = {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      reference: "DSAR-2026-0142",
      jurisdictionCode: "SG",
      legalEntity: "Acme Pte Ltd",
      controllerType: "PRIVATE_ORGANISATION",
      requestReceivedOn: "2026-08-20",
      requestorClass: "FORMER_EMPLOYEE",
      currency: "SGD",
      identityVerified: true,
      identityVerifiedNote: null,
      scopeClarified: true,
      isRepeatRequestWithin12Months: false,
      isKnownDisputeOrLitigation: false,
      createdBy: {
        id: "01ARZ3NDEKTSV4RRFFQ69G5FAW",
        displayName: "Jane HR",
        email: "jane@example.com",
      },
      createdAt: "2026-08-20T03:14:15Z",
    };
    // Sanity: this object is itself a valid Matter, ruling out "both fail
    // because the fixture is malformed" as an explanation.
    expect(MatterSchema.safeParse(matter).success).toBe(true);
    expect(ExpenseLineSchema.safeParse(matter).success).toBe(false);
  });
});
