// packages/schemas/src/matter.test.ts
//
// Falsifies MatterSchema: the jurisdiction/currency refinement (AC-42 schema
// layer), the identityVerifiedNote cap, required-field enumeration, the
// empty/null/undefined edge, and the SCHEMA-01 adjacency edge against
// ExpenseLineSchema.

import { describe, expect, it } from "vitest";
import { MatterSchema } from "./matter.ts";

function validMatter() {
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    reference: "DSAR-2026-0142",
    jurisdictionCode: "SG",
    legalEntity: "Acme Pte Ltd",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: "2026-08-20",
    requestorClass: "FORMER_EMPLOYEE",
    currency: "SGD",
    identityVerified: true,
    identityVerifiedNote: "See HR ticket #4821",
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
}

function validExpenseLine() {
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAX",
    matterId: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    seq: 0,
    categoryCode: "OTHER_UNCLASSIFIED",
    description: "Photocopying",
    quantity: 1,
    unit: "PAGE",
    unitRate: 10,
    claimedAmount: 10,
    incurredByGrade: null,
    isThirdPartyInvoiced: false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  };
}

describe("MatterSchema", () => {
  it("parses a matter whose currency matches its jurisdiction", () => {
    expect(MatterSchema.safeParse(validMatter()).success).toBe(true);
  });

  it("fails when currency is changed to any of the other eight codes, naming both codes", () => {
    const otherCurrencies = ["HKD", "AUD", "NZD", "JPY", "KRW", "CNY", "INR", "VND"] as const;
    for (const currency of otherCurrencies) {
      const result = MatterSchema.safeParse({ ...validMatter(), currency });
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((i) => i.message).join(" | ");
        expect(messages).toContain(currency);
        expect(messages).toContain("SGD");
      }
    }
  });

  it("accepts identityVerifiedNote of 200 characters", () => {
    const note = "a".repeat(200);
    const result = MatterSchema.safeParse({ ...validMatter(), identityVerifiedNote: note });
    expect(result.success).toBe(true);
  });

  it("rejects identityVerifiedNote of 201 characters", () => {
    const note = "a".repeat(201);
    const result = MatterSchema.safeParse({ ...validMatter(), identityVerifiedNote: note });
    expect(result.success).toBe(false);
  });

  it("accepts identityVerifiedNote of null", () => {
    const result = MatterSchema.safeParse({ ...validMatter(), identityVerifiedNote: null });
    expect(result.success).toBe(true);
  });

  it.each([
    "reference",
    "jurisdictionCode",
    "legalEntity",
    "controllerType",
    "requestReceivedOn",
    "requestorClass",
    "currency",
  ])("fails with an issue naming %s when it is omitted", (field) => {
    const matter = validMatter() as Record<string, unknown>;
    delete matter[field];
    const result = MatterSchema.safeParse(matter);
    expect(result.success).toBe(false);
    if (!result.success) {
      const namesField = result.error.issues.some((i) => i.path.includes(field));
      expect(namesField).toBe(true);
    }
  });

  it("fails on null, returning no partially-populated object", () => {
    const result = MatterSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it("fails on undefined, returning no partially-populated object", () => {
    const result = MatterSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it("fails on an empty object, returning no partially-populated object", () => {
    const result = MatterSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("fails to parse an ExpenseLine-shaped object despite both types having an id field", () => {
    const result = MatterSchema.safeParse(validExpenseLine());
    expect(result.success).toBe(false);
  });

  it("defaults status to DRAFT when absent", () => {
    const result = MatterSchema.safeParse(validMatter());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("DRAFT");
    }
  });
});
