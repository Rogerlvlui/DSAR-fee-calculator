// packages/engine/src/evaluate-line.test.ts
//
// PRD §8.1 steps 2 (posture-gate override) and 3 (the five treatments,
// plus AC-19's OTHER_UNCLASSIFIED override) — dispatched per line by
// evaluateLine(). Every constructed line is passed through
// AssessmentLineSchema.parse(), not just checked on its verdict field:
// the frozen bidirectional refinement (flagReasons empty unless FLAG, and
// vice versa) is the thing a treatment branch is most likely to violate
// by accident (02-RESEARCH.md Pitfall 2).

import { describe, expect, it } from "vitest";
import { AssessmentLineSchema } from "@dsar/schemas/assessment";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule } from "@dsar/schemas/rule-pack";
import { evaluateLine } from "./evaluate-line.ts";
import { EngineComputationFailure } from "./errors.ts";
import { REFERENCE_LINE, REFERENCE_MATTER } from "./__fixtures__/reference-matter.ts";

function rule(overrides: Partial<CategoryRule>): CategoryRule {
  return {
    ruleId: "TEST.RULE",
    categoryCode: "STAFF_TIME_SEARCH",
    treatment: "ALLOW",
    cap: null,
    conditions: [],
    basis: "Test basis text.",
    citation: { instrument: "TEST", provision: "s.1" },
    verificationStatus: "VERIFIED",
    verificationNote: null,
    ...overrides,
  };
}

function assertParses(line: ReturnType<typeof evaluateLine>): void {
  expect(() => AssessmentLineSchema.parse(line)).not.toThrow();
}

describe("per-line evaluation", () => {
  describe("posture-gate override (step 2)", () => {
    it("PROHIBITED forces DISALLOW even for an ALLOW-treatment rule", () => {
      const line = evaluateLine({
        line: REFERENCE_LINE,
        matter: REFERENCE_MATTER,
        rule: rule({ treatment: "ALLOW" }),
        feePosture: "PROHIBITED",
        assessmentLineId: "line-1",
      });
      expect(line.verdict).toBe("DISALLOW");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons).toEqual([]);
      assertParses(line);
    });

    it("PROHIBITED forces DISALLOW even for an OTHER_UNCLASSIFIED line (AC-14 wins over AC-19)", () => {
      const otherLine: ExpenseLine = ExpenseLineSchema.parse({
        ...REFERENCE_LINE,
        id: "line-other",
        categoryCode: "OTHER_UNCLASSIFIED",
        unit: "FIXED",
        quantity: 1,
        unitRate: 4500,
        claimedAmount: 4500,
        incurredByGrade: null,
      });
      const line = evaluateLine({
        line: otherLine,
        matter: REFERENCE_MATTER,
        rule: rule({ categoryCode: "OTHER_UNCLASSIFIED", treatment: "FLAG" }),
        feePosture: "PROHIBITED",
        assessmentLineId: "line-2",
      });
      expect(line.verdict).toBe("DISALLOW");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons).toEqual([]);
      assertParses(line);
    });

    it("NO_EXPRESS_AUTHORITY forces FLAG with exactly one reason, NO_FEE_AUTHORITY", () => {
      const line = evaluateLine({
        line: REFERENCE_LINE,
        matter: REFERENCE_MATTER,
        rule: rule({ treatment: "ALLOW" }),
        feePosture: "NO_EXPRESS_AUTHORITY",
        assessmentLineId: "line-3",
      });
      expect(line.verdict).toBe("FLAG");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons).toHaveLength(1);
      expect(line.flagReasons[0]?.code).toBe("NO_FEE_AUTHORITY");
      assertParses(line);
    });
  });

  describe("AC-19 — OTHER_UNCLASSIFIED under a permitting posture", () => {
    it("is FLAG with UNCATEGORISED even when the pack's own rule says ALLOW", () => {
      const otherLine: ExpenseLine = ExpenseLineSchema.parse({
        ...REFERENCE_LINE,
        id: "line-other-2",
        categoryCode: "OTHER_UNCLASSIFIED",
        unit: "FIXED",
        quantity: 1,
        unitRate: 4500,
        claimedAmount: 4500,
        incurredByGrade: null,
      });
      const line = evaluateLine({
        line: otherLine,
        matter: REFERENCE_MATTER,
        rule: rule({ categoryCode: "OTHER_UNCLASSIFIED", treatment: "ALLOW" }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-4",
      });
      expect(line.verdict).toBe("FLAG");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons).toHaveLength(1);
      expect(line.flagReasons[0]?.code).toBe("UNCATEGORISED");
      assertParses(line);
    });
  });

  describe("the five treatments under a permitting posture", () => {
    it("ALLOW: engineAmount equals claimedAmount", () => {
      const line = evaluateLine({
        line: REFERENCE_LINE,
        matter: REFERENCE_MATTER,
        rule: rule({ treatment: "ALLOW" }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-5",
      });
      expect(line.verdict).toBe("ALLOW");
      expect(line.engineAmount).toBe(16000);
      expect(line.appliedCap).toBeNull();
      assertParses(line);
    });

    it("ALLOW_WITH_CAP: verdict ALLOW_CAPPED and appliedCap set only when the cap actually reduces the amount", () => {
      const photocopyLine: ExpenseLine = ExpenseLineSchema.parse({
        ...REFERENCE_LINE,
        id: "line-photocopy",
        categoryCode: "PHOTOCOPY_PRINT",
        unit: "PAGE",
        quantity: 220,
        unitRate: 15,
        claimedAmount: 3300,
        incurredByGrade: null,
      });
      const cap = { type: "PER_UNIT" as const, amount: 12 as import("@dsar/schemas/primitives").Minor, unit: "PAGE" as const };
      const line = evaluateLine({
        line: photocopyLine,
        matter: REFERENCE_MATTER,
        rule: rule({ categoryCode: "PHOTOCOPY_PRINT", treatment: "ALLOW_WITH_CAP", cap }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-6",
      });
      expect(line.verdict).toBe("ALLOW_CAPPED");
      expect(line.engineAmount).toBe(2640);
      expect(line.appliedCap).toEqual(cap);
      assertParses(line);
    });

    it("ALLOW_WITH_CAP: a cap that does not bind comes back ALLOW, not ALLOW_CAPPED", () => {
      const cap = {
        type: "PER_LINE" as const,
        amount: 999999 as import("@dsar/schemas/primitives").Minor,
      };
      const line = evaluateLine({
        line: REFERENCE_LINE,
        matter: REFERENCE_MATTER,
        rule: rule({ treatment: "ALLOW_WITH_CAP", cap }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-7",
      });
      expect(line.verdict).toBe("ALLOW");
      expect(line.engineAmount).toBe(16000);
      expect(line.appliedCap).toBeNull();
      assertParses(line);
    });

    it("ALLOW_WITH_CAP: a missing cap raises a typed EngineComputationFailure", () => {
      expect(() =>
        evaluateLine({
          line: REFERENCE_LINE,
          matter: REFERENCE_MATTER,
          rule: rule({ treatment: "ALLOW_WITH_CAP", cap: null }),
          feePosture: "PERMITTED_REASONABLE",
          assessmentLineId: "line-8",
        })
      ).toThrow(EngineComputationFailure);
    });

    it("ALLOW_IF: conditions met behaves as ALLOW", () => {
      const vendorLine: ExpenseLine = ExpenseLineSchema.parse({
        ...REFERENCE_LINE,
        id: "line-vendor-met",
        categoryCode: "VENDOR_PAYROLL",
        unit: "ITEM",
        quantity: 3,
        unitRate: 15000,
        claimedAmount: 45000,
        isThirdPartyInvoiced: true,
        evidenceRef: "DMS-1234",
        incurredByGrade: null,
      });
      const line = evaluateLine({
        line: vendorLine,
        matter: REFERENCE_MATTER,
        rule: rule({
          categoryCode: "VENDOR_PAYROLL",
          treatment: "ALLOW_IF",
          conditions: [
            { field: "isThirdPartyInvoiced", op: "eq", value: true },
            { field: "evidenceRef", op: "isNotNull" },
          ],
        }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-9",
      });
      expect(line.verdict).toBe("ALLOW");
      expect(line.engineAmount).toBe(45000);
      assertParses(line);
    });

    it("ALLOW_IF: conditions unmet is FLAG with CONDITIONS_NOT_MET", () => {
      const vendorLine: ExpenseLine = ExpenseLineSchema.parse({
        ...REFERENCE_LINE,
        id: "line-vendor-unmet",
        categoryCode: "VENDOR_PAYROLL",
        unit: "ITEM",
        quantity: 3,
        unitRate: 15000,
        claimedAmount: 45000,
        isThirdPartyInvoiced: false,
        evidenceRef: null,
        incurredByGrade: null,
      });
      const line = evaluateLine({
        line: vendorLine,
        matter: REFERENCE_MATTER,
        rule: rule({
          categoryCode: "VENDOR_PAYROLL",
          treatment: "ALLOW_IF",
          conditions: [
            { field: "isThirdPartyInvoiced", op: "eq", value: true },
            { field: "evidenceRef", op: "isNotNull" },
          ],
        }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-10",
      });
      expect(line.verdict).toBe("FLAG");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons).toHaveLength(1);
      expect(line.flagReasons[0]?.code).toBe("CONDITIONS_NOT_MET");
      assertParses(line);
    });

    it("DISALLOW: engineAmount 0, no flag reasons", () => {
      const line = evaluateLine({
        line: REFERENCE_LINE,
        matter: REFERENCE_MATTER,
        rule: rule({ treatment: "DISALLOW" }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-11",
      });
      expect(line.verdict).toBe("DISALLOW");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons).toEqual([]);
      assertParses(line);
    });

    it("FLAG (rule-authored, not OTHER_UNCLASSIFIED): engineAmount 0, a non-empty flag reason", () => {
      const line = evaluateLine({
        line: REFERENCE_LINE,
        matter: REFERENCE_MATTER,
        rule: rule({ treatment: "FLAG" }),
        feePosture: "PERMITTED_REASONABLE",
        assessmentLineId: "line-12",
      });
      expect(line.verdict).toBe("FLAG");
      expect(line.engineAmount).toBe(0);
      expect(line.flagReasons.length).toBeGreaterThan(0);
      assertParses(line);
    });
  });
});
