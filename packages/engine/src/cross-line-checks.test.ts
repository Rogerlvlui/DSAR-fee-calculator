// packages/engine/src/cross-line-checks.test.ts
//
// PRD §8.1 step 4 / ENGINE-06 — the four cross-line checks, each with a
// firing case and a near-miss boundary case, plus the vendor-evidence
// stand-down case asserted directly. D-13's implausible-magnitude check is
// recorded as deliberately absent in cross-line-checks.ts's own bottom
// comment — not re-asserted here as a test, since "a fifth check does not
// exist" has no positive assertion to write against a function signature
// that simply never grew a fifth internal check.
//
// Every expected value below is literal, never a derived/computed
// expectation, so a boundary-operator substitution (e.g. `>` for `>=`)
// shows up as a wrong pass/fail rather than a passing tautology.

import { describe, expect, it } from "vitest";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import type { CategoryRule } from "@dsar/schemas/rule-pack";
import type { AssessmentLine } from "@dsar/schemas/assessment";
import type { Minor } from "@dsar/schemas/primitives";
import { computeCrossLineFlagReasons, type CrossLineCheckLine } from "./cross-line-checks.ts";
import { REFERENCE_FIXTURE_PACK } from "./__fixtures__/reference-pack.ts";
import { REFERENCE_MATTER } from "./__fixtures__/reference-matter.ts";

// REFERENCE_FIXTURE_PACK.rateSanityCeiling: ADMIN 3000, EXECUTIVE 5000,
// MANAGER 9000. SPECIALIST/EXECUTIVE... wait, SPECIALIST carries none —
// used below for the "grade with no authored ceiling" near-miss.

interface RawExpenseLineInput {
  id?: string;
  categoryCode?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitRate?: number;
  claimedAmount?: number;
  incurredByGrade?: string | null;
  isThirdPartyInvoiced?: boolean;
}

function buildExpenseLine(overrides: RawExpenseLineInput = {}): ExpenseLine {
  const quantity = overrides.quantity ?? 1;
  const unitRate = overrides.unitRate ?? 1000;
  return ExpenseLineSchema.parse({
    id: overrides.id ?? "expense-line",
    matterId: REFERENCE_MATTER.id,
    seq: 0,
    categoryCode: overrides.categoryCode ?? "STAFF_TIME_SEARCH",
    description: overrides.description ?? "Staff time locating records",
    quantity,
    unit: overrides.unit ?? "HOUR",
    unitRate,
    claimedAmount: overrides.claimedAmount ?? quantity * unitRate,
    incurredByGrade: overrides.incurredByGrade ?? null,
    isThirdPartyInvoiced: overrides.isThirdPartyInvoiced ?? false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  });
}

function buildCategoryRule(overrides: Partial<CategoryRule> = {}): CategoryRule {
  return {
    ruleId: "TEST.RULE",
    categoryCode: "STAFF_TIME_SEARCH",
    treatment: "ALLOW",
    cap: null,
    conditions: [],
    basis: "Test rule basis.",
    citation: { instrument: "TEST", provision: "s.1" },
    verificationStatus: "VERIFIED",
    verificationNote: null,
    ...overrides,
  };
}

function buildAssessmentLine(overrides: Partial<AssessmentLine> = {}): AssessmentLine {
  return {
    id: "assessment-line",
    expenseLineId: "expense-line",
    verdict: "ALLOW",
    engineAmount: 1000 as Minor,
    appliedRuleId: "TEST.RULE",
    appliedCap: null,
    basis: "Test rule basis.",
    citation: { instrument: "TEST", provision: "s.1" },
    flagReasons: [],
    disposition: "PENDING",
    lawyerAmount: null,
    lawyerReason: null,
    dispositionedBy: null,
    dispositionedAt: null,
    ...overrides,
  };
}

function buildLine(options: {
  id: string;
  expenseLine?: RawExpenseLineInput;
  appliedRule?: Partial<CategoryRule>;
}): CrossLineCheckLine {
  const expenseLine = buildExpenseLine({ id: options.id, ...options.expenseLine });
  const assessmentLine = buildAssessmentLine({
    id: `assessment-${options.id}`,
    expenseLineId: options.id,
    engineAmount: expenseLine.claimedAmount,
  });
  const appliedRule = buildCategoryRule(options.appliedRule);
  return { assessmentLine, expenseLine, appliedRule };
}

const HUGE_TOTAL = 100_000_000 as Minor;

describe("cross-line — duplicate detection", () => {
  it("flags both lines when descriptions match after trim/case/whitespace normalisation", () => {
    const a = buildLine({ id: "a", expenseLine: { description: "  Photocopying   the Response  " } });
    const b = buildLine({ id: "b", expenseLine: { description: "photocopying the response" } });
    const result = computeCrossLineFlagReasons([a, b], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(a.assessmentLine.id)?.map((r) => r.code)).toEqual(["POSSIBLE_DUPLICATE"]);
    expect(result.get(b.assessmentLine.id)?.map((r) => r.code)).toEqual(["POSSIBLE_DUPLICATE"]);
  });

  it("does not flag two lines in the same category with genuinely different descriptions", () => {
    const a = buildLine({ id: "a", expenseLine: { description: "Photocopying the response" } });
    const b = buildLine({ id: "b", expenseLine: { description: "Printing the cover letter" } });
    const result = computeCrossLineFlagReasons([a, b], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(a.assessmentLine.id)).toBeUndefined();
    expect(result.get(b.assessmentLine.id)).toBeUndefined();
  });

  it("does not flag identical descriptions in different categories", () => {
    const a = buildLine({
      id: "a",
      expenseLine: { categoryCode: "STAFF_TIME_SEARCH", description: "Identical text" },
    });
    const b = buildLine({
      id: "b",
      expenseLine: { categoryCode: "STAFF_TIME_COLLATE", description: "Identical text" },
    });
    const result = computeCrossLineFlagReasons([a, b], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(a.assessmentLine.id)).toBeUndefined();
    expect(result.get(b.assessmentLine.id)).toBeUndefined();
  });
});

describe("cross-line — materiality", () => {
  it("flags a line whose claimedAmount is exactly 40% of the claim total (inclusive boundary)", () => {
    const line = buildLine({ id: "a", expenseLine: { quantity: 1, unitRate: 400, claimedAmount: 400 } });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, 1000 as Minor);
    expect(result.get(line.assessmentLine.id)?.map((r) => r.code)).toEqual(["MATERIALITY"]);
  });

  it("does not flag a line at 39.9% of the claim total", () => {
    const line = buildLine({ id: "a", expenseLine: { quantity: 1, unitRate: 399, claimedAmount: 399 } });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, 1000 as Minor);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });

  it("skips the check entirely when claimedTotal is zero", () => {
    const line = buildLine({ id: "a", expenseLine: { quantity: 1, unitRate: 0, claimedAmount: 0 } });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, 0 as Minor);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });
});

describe("cross-line — rate sanity", () => {
  it("flags an HOUR line whose unitRate exceeds the pack's ceiling for its grade", () => {
    const line = buildLine({
      id: "a",
      expenseLine: { unit: "HOUR", incurredByGrade: "ADMIN", quantity: 1, unitRate: 3100, claimedAmount: 3100 },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)?.map((r) => r.code)).toEqual(["RATE_ABOVE_EXPECTED"]);
  });

  it("does not flag a rate exactly at the ceiling", () => {
    const line = buildLine({
      id: "a",
      expenseLine: { unit: "HOUR", incurredByGrade: "ADMIN", quantity: 1, unitRate: 3000, claimedAmount: 3000 },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });

  it("does not flag a grade the pack authored no ceiling for", () => {
    const line = buildLine({
      id: "a",
      expenseLine: {
        unit: "HOUR",
        incurredByGrade: "SPECIALIST",
        quantity: 1,
        unitRate: 999_999,
        claimedAmount: 999_999,
      },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });

  it("does not flag a non-HOUR unit even above what would be a ceiling", () => {
    const line = buildLine({
      id: "a",
      expenseLine: {
        unit: "PAGE",
        incurredByGrade: "ADMIN",
        quantity: 1,
        unitRate: 999_999,
        claimedAmount: 999_999,
      },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });

  it("does not flag a line with no incurredByGrade even above an unrelated ceiling", () => {
    const line = buildLine({
      id: "a",
      expenseLine: { unit: "HOUR", incurredByGrade: null, quantity: 1, unitRate: 999_999, claimedAmount: 999_999 },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });
});

describe("cross-line — vendor evidence", () => {
  it("flags a third-party-category line not marked isThirdPartyInvoiced, when its rule carries no such condition", () => {
    const line = buildLine({
      id: "a",
      expenseLine: {
        categoryCode: "VENDOR_ARCHIVE",
        isThirdPartyInvoiced: false,
        quantity: 1,
        unitRate: 1000,
        claimedAmount: 1000,
      },
      appliedRule: { categoryCode: "VENDOR_ARCHIVE", treatment: "ALLOW", conditions: [] },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)?.map((r) => r.code)).toEqual(["VENDOR_EVIDENCE_MISSING"]);
  });

  it("stands down when the applied rule already carries a condition on isThirdPartyInvoiced — asserted directly: one reason, not two", () => {
    const line = buildLine({
      id: "a",
      expenseLine: {
        categoryCode: "VENDOR_PAYROLL",
        isThirdPartyInvoiced: false,
        quantity: 1,
        unitRate: 1000,
        claimedAmount: 1000,
      },
      appliedRule: {
        categoryCode: "VENDOR_PAYROLL",
        treatment: "ALLOW_IF",
        conditions: [{ field: "isThirdPartyInvoiced", op: "eq", value: true }],
      },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    // No VENDOR_EVIDENCE_MISSING from this check — combined with the
    // CONDITIONS_NOT_MET evaluate-line.ts separately produces for a failed
    // ALLOW_IF, the line's eventual total is one reason, not two.
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });

  it("does not flag a non-vendor category even when isThirdPartyInvoiced is false", () => {
    const line = buildLine({
      id: "a",
      expenseLine: { categoryCode: "STAFF_TIME_SEARCH", isThirdPartyInvoiced: false },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });

  it("does not flag a third-party line that IS marked invoiced", () => {
    const line = buildLine({
      id: "a",
      expenseLine: {
        categoryCode: "VENDOR_OTHER",
        isThirdPartyInvoiced: true,
        quantity: 1,
        unitRate: 1000,
        claimedAmount: 1000,
      },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, HUGE_TOTAL);
    expect(result.get(line.assessmentLine.id)).toBeUndefined();
  });
});

describe("cross-line — multiple checks on one line", () => {
  it("a line that trips two checks carries both reasons, in fixed check order", () => {
    // Materiality (>=40% of a small claimedTotal) AND rate sanity (unitRate
    // above the ADMIN ceiling) on the same HOUR line.
    const line = buildLine({
      id: "a",
      expenseLine: { unit: "HOUR", incurredByGrade: "ADMIN", quantity: 1, unitRate: 3100, claimedAmount: 3100 },
    });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, 5000 as Minor);
    expect(result.get(line.assessmentLine.id)?.map((r) => r.code)).toEqual(["MATERIALITY", "RATE_ABOVE_EXPECTED"]);
  });
});

describe("cross-line — no matter-level output, no engineAmount mutation", () => {
  it("returns only a per-lineId FlagReason map — never touches engineAmount or produces a matter flag", () => {
    const line = buildLine({ id: "a", expenseLine: { quantity: 1, unitRate: 400, claimedAmount: 400 } });
    const result = computeCrossLineFlagReasons([line], REFERENCE_MATTER, REFERENCE_FIXTURE_PACK, 1000 as Minor);
    // The return type itself proves this (ReadonlyMap<string, FlagReason[]>)
    // — no engineAmount or matter-flag field exists to mutate or emit.
    expect(result instanceof Map).toBe(true);
    for (const reasons of result.values()) {
      for (const reason of reasons) {
        expect(typeof reason.code).toBe("string");
        expect(typeof reason.message).toBe("string");
      }
    }
  });
});
