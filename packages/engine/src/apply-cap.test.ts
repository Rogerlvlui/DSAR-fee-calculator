// packages/engine/src/apply-cap.test.ts
//
// PRD §13 AC-07c and §14's boundary-case list (zero quantity, cap exactly
// equal to claim, cap below claim, negative rate rejected — negative rate
// is covered by preconditions.test.ts, not here). Every case below is a
// literal value, never a derived/computed expectation, so a rounding
// substitution shows up as a wrong literal rather than a passing tautology.

import { describe, expect, it } from "vitest";
import type { Cap } from "@dsar/schemas/rule-pack";
import type { Minor } from "@dsar/schemas/primitives";
import { applyCap, type ApplyCapLine } from "./apply-cap.ts";
import { EngineComputationFailure } from "./errors.ts";

function line(overrides: Partial<ApplyCapLine>): ApplyCapLine {
  return {
    claimedAmount: 0 as Minor,
    quantity: 1,
    unit: "ITEM",
    ...overrides,
  };
}

describe("applyCap", () => {
  it("PER_UNIT: multiplies amount by quantity exactly, no rounding needed", () => {
    const cap: Cap = { type: "PER_UNIT", amount: 12 as Minor, unit: "PAGE" };
    expect(applyCap(cap, line({ claimedAmount: 3300 as Minor, quantity: 220, unit: "PAGE" }))).toBe(2640);
  });

  it("PER_UNIT: AC-07c's own example — 12/page on 7 pages, claimed 84, returns 84", () => {
    const cap: Cap = { type: "PER_UNIT", amount: 12 as Minor, unit: "PAGE" };
    expect(applyCap(cap, line({ claimedAmount: 84 as Minor, quantity: 7, unit: "PAGE" }))).toBe(84);
  });

  it("PERCENT_OF_CLAIM: AC-07c's own example — 33 percent of 100 returns 33, not 34", () => {
    const cap: Cap = { type: "PERCENT_OF_CLAIM", percent: 33 };
    expect(applyCap(cap, line({ claimedAmount: 100 as Minor }))).toBe(33);
  });

  it("PERCENT_OF_CLAIM: a fractional percent floors to zero — a Math.round implementation gets this wrong", () => {
    const cap: Cap = { type: "PERCENT_OF_CLAIM", percent: 33.33 };
    expect(applyCap(cap, line({ claimedAmount: 3 as Minor }))).toBe(0);
  });

  it("PER_LINE: a cap above the claim never inflates it", () => {
    const cap: Cap = { type: "PER_LINE", amount: 5000 as Minor };
    expect(applyCap(cap, line({ claimedAmount: 1200 as Minor }))).toBe(1200);
  });

  it("a cap exactly equal to the claim returns the claim unchanged (PER_LINE)", () => {
    const cap: Cap = { type: "PER_LINE", amount: 1200 as Minor };
    expect(applyCap(cap, line({ claimedAmount: 1200 as Minor }))).toBe(1200);
  });

  it("a cap exactly equal to the claim returns the claim unchanged (PER_UNIT)", () => {
    const cap: Cap = { type: "PER_UNIT", amount: 10 as Minor, unit: "PAGE" };
    expect(applyCap(cap, line({ claimedAmount: 20 as Minor, quantity: 2, unit: "PAGE" }))).toBe(20);
  });

  it("a cap exactly equal to the claim returns the claim unchanged (PERCENT_OF_CLAIM)", () => {
    const cap: Cap = { type: "PERCENT_OF_CLAIM", percent: 100 };
    expect(applyCap(cap, line({ claimedAmount: 500 as Minor }))).toBe(500);
  });

  it("a zero claim returns zero for every cap type", () => {
    const perUnit: Cap = { type: "PER_UNIT", amount: 12 as Minor, unit: "PAGE" };
    const perLine: Cap = { type: "PER_LINE", amount: 5000 as Minor };
    const percent: Cap = { type: "PERCENT_OF_CLAIM", percent: 50 };

    expect(applyCap(perUnit, line({ claimedAmount: 0 as Minor, quantity: 10, unit: "PAGE" }))).toBe(0);
    expect(applyCap(perLine, line({ claimedAmount: 0 as Minor }))).toBe(0);
    expect(applyCap(percent, line({ claimedAmount: 0 as Minor }))).toBe(0);
  });

  it("rejects a PER_MATTER cap with a typed EngineComputationFailure naming the cap type", () => {
    const cap: Cap = { type: "PER_MATTER", amount: 100000 as Minor };

    expect(() => applyCap(cap, line({ claimedAmount: 100 as Minor }))).toThrow(EngineComputationFailure);

    try {
      applyCap(cap, line({ claimedAmount: 100 as Minor }));
      expect.unreachable("applyCap must throw for a PER_MATTER cap");
    } catch (error) {
      expect(error).toBeInstanceOf(EngineComputationFailure);
      expect((error as EngineComputationFailure).code).toBe("PER_MATTER_CAP_ON_LINE");
      expect((error as EngineComputationFailure).detail).toEqual({ capType: "PER_MATTER" });
    }
  });
});
