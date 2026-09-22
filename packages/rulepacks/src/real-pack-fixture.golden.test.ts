// packages/rulepacks/src/real-pack-fixture.golden.test.ts
//
// ENGINE-14/AC-09's golden-file test for the REAL committed HK-PDPO and
// SG-PDPA packs — scoped to the categories the product owner's 2026-09-20
// deferral decision left as the actually-authored subset (9/21 HK, 6/21
// SG). Every expected value below is a literal, hand-derived by direct
// arithmetic against each pack's own authored treatment/cap/conditions
// fields (06-01-PLAN.md's own derivation table), compared with `toEqual` —
// no vitest snapshot matcher of any kind, per §14's own "changing a pack
// must break its golden files" instruction.
//
// Package boundary note (load-bearing, do not "fix"): this file lives in
// packages/rulepacks, NOT packages/engine as 06-RESEARCH.md's file-location
// suggestion tentatively assumed — confirmed via direct package.json reads
// that packages/engine has ZERO dependency on @dsar/rulepacks (only
// packages/rulepacks depends on @dsar/engine, one-way), so a test needing
// both assess() and real pack JSON cannot legally live inside
// packages/engine. This file must not import anything from apps/web —
// apps/web/src/server/engine-invocation.ts's coercePackForDemoEngine is
// duplicated inline below (three lines) rather than imported, since the
// dependency direction only runs packages/rulepacks -> packages/engine,
// never the other way through apps/web.

import { describe, expect, it } from "vitest";
import { assess } from "@dsar/engine";
import { AssessmentSchema } from "@dsar/schemas/assessment";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import type { Matter } from "@dsar/schemas/matter";
import type { RulePack } from "@dsar/schemas/rule-pack";
import { resolveRulePack } from "./loader.ts";

// Duplicated from apps/web/src/server/engine-invocation.ts's
// coercePackForDemoEngine — a three-line duplication, not a new shared
// module, since the two call sites can never share code across the
// packages/rulepacks -> apps/web dependency boundary (which does not, and
// must not, exist).
function nowActive(loaded: ReturnType<typeof resolveRulePack>): RulePack {
  return {
    ...loaded,
    status: "ACTIVE" as const,
    constraints: loaded.constraints as RulePack["constraints"],
  };
}

// Far from both packs' reviewDueOn (HK 2027-09-01, SG 2027-03-12), so
// STALE_PACK_WARNING never fires and does not need to be accounted for in
// the expected matter-level flags.
const NOW = "2026-09-20T00:00:00.000Z";

function buildMatter(overrides: Partial<Matter>): Matter {
  return {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FA0",
    reference: "DSAR-2026-GOLDEN",
    jurisdictionCode: "SG",
    legalEntity: "Acme Pte Ltd",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: "2026-09-01",
    requestorClass: "FORMER_EMPLOYEE",
    currency: "SGD",
    identityVerified: true,
    identityVerifiedNote: null,
    scopeClarified: true,
    isRepeatRequestWithin12Months: false,
    isKnownDisputeOrLitigation: false,
    status: "DRAFT",
    createdBy: {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FA1",
      displayName: "Jane HR",
      email: "jane@example.com",
    },
    createdAt: "2026-09-01T03:14:15Z",
    ...overrides,
  };
}

interface BuildLineOverrides {
  categoryCode: ExpenseLine["categoryCode"];
  unit: ExpenseLine["unit"];
  quantity: number;
  unitRate: number;
  isThirdPartyInvoiced: boolean;
  evidenceRef: string | null;
}

function buildLine(seq: number, overrides: BuildLineOverrides): ExpenseLine {
  return ExpenseLineSchema.parse({
    id: `01ARZ3NDEKTSV4RRFFQ69G5F${String(10 + seq).padStart(2, "0")}`,
    matterId: "01ARZ3NDEKTSV4RRFFQ69G5FA0",
    seq,
    description: `Golden-fixture line ${seq}`,
    quantity: overrides.quantity,
    unit: overrides.unit,
    unitRate: overrides.unitRate,
    claimedAmount: overrides.quantity * overrides.unitRate,
    categoryCode: overrides.categoryCode,
    incurredByGrade: null,
    isThirdPartyInvoiced: overrides.isThirdPartyInvoiced,
    vendorName: null,
    evidenceRef: overrides.evidenceRef,
    hrNote: null,
  });
}

describe("REAL-PACK-GOLDEN: HK-PDPO 2026.09.1 (9 authored categories)", () => {
  const hkMatter = buildMatter({ jurisdictionCode: "HK", controllerType: "PRIVATE_ORGANISATION", currency: "HKD" });

  const hkLines: ExpenseLine[] = [
    buildLine(0, { categoryCode: "STAFF_TIME_SEARCH", unit: "HOUR", quantity: 4, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(1, { categoryCode: "STAFF_TIME_REDACT_THIRD_PARTY", unit: "HOUR", quantity: 3, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(2, { categoryCode: "STAFF_TIME_REDACT_EXEMPT", unit: "HOUR", quantity: 2, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(3, { categoryCode: "STAFF_TIME_LEGAL_REVIEW", unit: "HOUR", quantity: 1, unitRate: 3000, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(4, { categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE", quantity: 100, unitRate: 200, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(5, { categoryCode: "VENDOR_PAYROLL", unit: "FIXED", quantity: 1, unitRate: 5000, isThirdPartyInvoiced: true, evidenceRef: "INV-2026-HK-01" }),
    buildLine(6, { categoryCode: "ADMIN_OVERHEAD", unit: "HOUR", quantity: 2, unitRate: 1500, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(7, { categoryCode: "RECORDS_REMEDIATION", unit: "HOUR", quantity: 1, unitRate: 2500, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(8, { categoryCode: "OTHER_UNCLASSIFIED", unit: "FIXED", quantity: 1, unitRate: 1000, isThirdPartyInvoiced: false, evidenceRef: null }),
  ];

  function runHk() {
    const loaded = resolveRulePack("HK-PDPO", "2026.09.1");
    const pack = nowActive(loaded);
    return assess({ matter: hkMatter, lines: hkLines, pack, now: NOW });
  }

  it("REAL-PACK-GOLDEN: reproduces the nine authored categories' verdicts and engine amounts exactly", () => {
    const result = runHk();
    expect(result.lines.map((line) => ({ verdict: line.verdict, engineAmount: line.engineAmount }))).toEqual([
      { verdict: "ALLOW", engineAmount: 8000 },
      { verdict: "ALLOW", engineAmount: 6000 },
      { verdict: "DISALLOW", engineAmount: 0 },
      { verdict: "DISALLOW", engineAmount: 0 },
      { verdict: "ALLOW_CAPPED", engineAmount: 15000 },
      { verdict: "ALLOW", engineAmount: 5000 },
      { verdict: "DISALLOW", engineAmount: 0 },
      { verdict: "DISALLOW", engineAmount: 0 },
      { verdict: "FLAG", engineAmount: 0 },
    ]);
  });

  it("REAL-PACK-GOLDEN: PHOTOCOPY_PRINT's appliedCap is PER_UNIT/150/PAGE, every other line's is null", () => {
    const result = runHk();
    expect(result.lines[4]?.appliedCap).toEqual({ type: "PER_UNIT", amount: 150, unit: "PAGE" });
    for (const [index, line] of result.lines.entries()) {
      if (index === 4) continue;
      expect(line.appliedCap).toBeNull();
    }
  });

  it("REAL-PACK-GOLDEN: OTHER_UNCLASSIFIED carries exactly one UNCATEGORISED flag reason", () => {
    const result = runHk();
    const line = result.lines[8];
    expect(line?.flagReasons).toHaveLength(1);
    expect(line?.flagReasons[0]?.code).toBe("UNCATEGORISED");
  });

  it("REAL-PACK-GOLDEN: reproduces the exact published totals", () => {
    const result = runHk();
    expect(result.totals).toEqual({
      claimedTotal: 52500,
      draftBaseline: 34000,
      disallowedTotal: 17500,
      flaggedTotal: 1000,
      restingOnUnverifiedRules: 34000,
      finalAmount: null,
      flatFeeComparison: { flatFeeAmount: 10000, itemisedDirectCostAmount: 34000, flatFeeExceedsItemisedCost: false },
    });
  });

  it("REAL-PACK-GOLDEN: reproduces the exact two matter-level PACK_FLAG entries, in order, none requiring acknowledgement", () => {
    const result = runHk();
    expect(result.matterLevelFlags).toHaveLength(2);
    expect(result.matterLevelFlags.map((flag) => ({ id: flag.id, code: flag.code, requiresAcknowledgement: flag.requiresAcknowledgement }))).toEqual([
      { id: "HK.FLAT_FEE_CHECK", code: "PACK_FLAG", requiresAcknowledgement: false },
      { id: "HK.NOTIFY_40_DAYS", code: "PACK_FLAG", requiresAcknowledgement: false },
    ]);
  });

  it("REAL-PACK-GOLDEN: produces a schema-valid Assessment end to end", () => {
    const result = runHk();
    expect(() => AssessmentSchema.parse(result)).not.toThrow();
  });
});

describe("REAL-PACK-GOLDEN: SG-PDPA 2026.09.1 (6 authored categories)", () => {
  const sgMatter = buildMatter({ jurisdictionCode: "SG", controllerType: "PRIVATE_ORGANISATION", currency: "SGD" });

  const sgLines: ExpenseLine[] = [
    buildLine(0, { categoryCode: "STAFF_TIME_SEARCH", unit: "HOUR", quantity: 5, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(1, { categoryCode: "STAFF_TIME_COLLATE", unit: "HOUR", quantity: 3, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(2, { categoryCode: "STAFF_TIME_ASSESS_EXEMPTIONS", unit: "HOUR", quantity: 2, unitRate: 2500, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(3, { categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE", quantity: 50, unitRate: 50, isThirdPartyInvoiced: false, evidenceRef: null }),
    buildLine(4, { categoryCode: "VENDOR_PAYROLL", unit: "FIXED", quantity: 1, unitRate: 4000, isThirdPartyInvoiced: true, evidenceRef: "INV-2026-SG-01" }),
    buildLine(5, { categoryCode: "OTHER_UNCLASSIFIED", unit: "FIXED", quantity: 1, unitRate: 1000, isThirdPartyInvoiced: false, evidenceRef: null }),
  ];

  function runSg() {
    const loaded = resolveRulePack("SG-PDPA", "2026.09.1");
    const pack = nowActive(loaded);
    return assess({ matter: sgMatter, lines: sgLines, pack, now: NOW });
  }

  it("REAL-PACK-GOLDEN: reproduces the six authored categories' verdicts and engine amounts exactly", () => {
    const result = runSg();
    expect(result.lines.map((line) => ({ verdict: line.verdict, engineAmount: line.engineAmount }))).toEqual([
      { verdict: "ALLOW", engineAmount: 10000 },
      { verdict: "ALLOW", engineAmount: 6000 },
      { verdict: "DISALLOW", engineAmount: 0 },
      { verdict: "ALLOW_CAPPED", engineAmount: 600 },
      { verdict: "ALLOW", engineAmount: 4000 },
      { verdict: "FLAG", engineAmount: 0 },
    ]);
  });

  it("REAL-PACK-GOLDEN: PHOTOCOPY_PRINT's appliedCap is PER_UNIT/12/PAGE", () => {
    const result = runSg();
    expect(result.lines[3]?.appliedCap).toEqual({ type: "PER_UNIT", amount: 12, unit: "PAGE" });
  });

  it("REAL-PACK-GOLDEN: reproduces the exact published totals, and flatFeeComparison is explicitly undefined (SG's pack carries no flatFee)", () => {
    const result = runSg();
    expect(result.totals).toEqual({
      claimedTotal: 28500,
      draftBaseline: 20600,
      disallowedTotal: 6900,
      flaggedTotal: 1000,
      restingOnUnverifiedRules: 20600,
      finalAmount: null,
    });
    // A separate, explicit assertion: toEqual above would pass identically
    // whether flatFeeComparison were omitted or set to `undefined`, so this
    // makes "no flat fee for SG" an intentional, checked fact rather than
    // an accident of toEqual's own equivalence rules.
    expect(result.totals.flatFeeComparison).toBeUndefined();
  });

  it("REAL-PACK-GOLDEN: reproduces the exact three matter-level PACK_FLAG entries, in order, none requiring acknowledgement", () => {
    const result = runSg();
    expect(result.matterLevelFlags).toHaveLength(3);
    expect(result.matterLevelFlags.map((flag) => ({ id: flag.id, code: flag.code, requiresAcknowledgement: flag.requiresAcknowledgement }))).toEqual([
      { id: "SG.WRITTEN_ESTIMATE", code: "PACK_FLAG", requiresAcknowledgement: false },
      { id: "SG.RESPOND_30_DAYS", code: "PACK_FLAG", requiresAcknowledgement: false },
      { id: "SG.NOT_A_DETERRENT", code: "PACK_FLAG", requiresAcknowledgement: false },
    ]);
  });

  it("REAL-PACK-GOLDEN: produces a schema-valid Assessment end to end", () => {
    const result = runSg();
    expect(() => AssessmentSchema.parse(result)).not.toThrow();
  });
});

describe("REAL-PACK-GOLDEN: mutation sensitivity — the golden assertions are sensitive to real pack content, not tautological", () => {
  it("REAL-PACK-GOLDEN: mutating a shallow, in-memory-only copy of HK's STAFF_TIME_SEARCH treatment to DISALLOW changes the first line's verdict and drops draftBaseline by exactly its own claimed amount — never writing the committed file", () => {
    const hkMatter = buildMatter({ jurisdictionCode: "HK", controllerType: "PRIVATE_ORGANISATION", currency: "HKD" });
    const hkLines: ExpenseLine[] = [
      buildLine(0, { categoryCode: "STAFF_TIME_SEARCH", unit: "HOUR", quantity: 4, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(1, { categoryCode: "STAFF_TIME_REDACT_THIRD_PARTY", unit: "HOUR", quantity: 3, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(2, { categoryCode: "STAFF_TIME_REDACT_EXEMPT", unit: "HOUR", quantity: 2, unitRate: 2000, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(3, { categoryCode: "STAFF_TIME_LEGAL_REVIEW", unit: "HOUR", quantity: 1, unitRate: 3000, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(4, { categoryCode: "PHOTOCOPY_PRINT", unit: "PAGE", quantity: 100, unitRate: 200, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(5, { categoryCode: "VENDOR_PAYROLL", unit: "FIXED", quantity: 1, unitRate: 5000, isThirdPartyInvoiced: true, evidenceRef: "INV-2026-HK-01" }),
      buildLine(6, { categoryCode: "ADMIN_OVERHEAD", unit: "HOUR", quantity: 2, unitRate: 1500, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(7, { categoryCode: "RECORDS_REMEDIATION", unit: "HOUR", quantity: 1, unitRate: 2500, isThirdPartyInvoiced: false, evidenceRef: null }),
      buildLine(8, { categoryCode: "OTHER_UNCLASSIFIED", unit: "FIXED", quantity: 1, unitRate: 1000, isThirdPartyInvoiced: false, evidenceRef: null }),
    ];

    const loaded = resolveRulePack("HK-PDPO", "2026.09.1");
    const originalPack = nowActive(loaded);
    const originalResult = assess({ matter: hkMatter, lines: hkLines, pack: originalPack, now: NOW });
    expect(originalResult.lines[0]?.verdict).toBe("ALLOW");
    expect(originalResult.totals.draftBaseline).toBe(34000);

    // A shallow copy with ONLY the in-memory categoryRules array replaced —
    // the committed JSON file on disk is never touched (D-16, the product
    // owner's 2026-09-18 decision, engine-invocation.ts's module comment).
    const mutatedPack: RulePack = {
      ...originalPack,
      categoryRules: originalPack.categoryRules.map((rule) =>
        rule.ruleId === "HK-PDPO.STAFF_TIME_SEARCH" ? { ...rule, treatment: "DISALLOW" as const } : rule
      ),
    };

    const mutatedResult = assess({ matter: hkMatter, lines: hkLines, pack: mutatedPack, now: NOW });

    expect(mutatedResult.lines[0]?.verdict).toBe("DISALLOW");
    expect(mutatedResult.lines[0]?.engineAmount).toBe(0);
    // Traceable to the exact mutated line's own claimed amount (8000), not
    // merely "some other total changed too".
    expect(originalResult.totals.draftBaseline - mutatedResult.totals.draftBaseline).toBe(8000);
    expect(mutatedResult.totals.draftBaseline).toBe(26000);

    // The committed file on disk is unaffected by this in-memory mutation —
    // re-resolving from disk still shows the real, unmutated ALLOW treatment.
    const reResolved = resolveRulePack("HK-PDPO", "2026.09.1");
    const reResolvedRule = reResolved.categoryRules.find((rule) => rule.ruleId === "HK-PDPO.STAFF_TIME_SEARCH");
    expect(reResolvedRule?.treatment).toBe("ALLOW");
  });
});
