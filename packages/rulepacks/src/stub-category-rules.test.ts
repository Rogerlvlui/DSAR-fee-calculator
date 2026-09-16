// packages/rulepacks/src/stub-category-rules.test.ts
//
// D-19 (03-CONTEXT.md): the committed JSON and the generator must never
// silently disagree. Follows packages/schemas/src/json-schema.test.ts's
// regenerate-in-memory-and-compare pattern, scoped per-rule by the
// UNAUTHORED_TOKEN marker (CONTEXT.md's Claude's Discretion item 1) — a
// rule leaves the generator's scope the moment its `verificationNote` no
// longer carries the token, rule by rule, never file by file.

import { describe, expect, it } from "vitest";
import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import type { CategoryRule } from "@dsar/schemas/rule-pack";
import { loadAllRulePacks } from "./loader.ts";
import {
  generateStubCategoryRules,
  PACK_JURISDICTIONS,
  UnknownPackJurisdictionError,
} from "./stub-category-rules.ts";

// Partitions a pack's categoryRules into token-bearing (still generator-
// owned) and released (hand-authored, out of scope) — the single scoping
// rule the drift test and (eventually) the ACTIVE gate both read.
function tokenBearingRules(rules: readonly CategoryRule[]): CategoryRule[] {
  return rules.filter((rule) => rule.verificationNote?.startsWith(UNAUTHORED_TOKEN) ?? false);
}

describe("stub category rule generator drift (D-19)", () => {
  it("drift: every token-bearing categoryRule in the committed tree deep-equals generateStubCategoryRules()'s rule for the same categoryCode", () => {
    const packs = loadAllRulePacks();
    expect(packs.length).toBeGreaterThan(0);

    for (const pack of packs) {
      const tokenBearing = tokenBearingRules(pack.categoryRules);
      if (tokenBearing.length === 0) continue;

      const generated = generateStubCategoryRules(pack.packId);
      const generatedByCode = new Map(generated.map((rule) => [rule.categoryCode, rule]));

      for (const rule of tokenBearing) {
        expect(rule).toEqual(generatedByCode.get(rule.categoryCode));
      }
    }
  });

  it("a rule whose verificationNote no longer carries the token is excluded from the comparison — the remaining rules still compare", () => {
    const packs = loadAllRulePacks();
    const vnPack = packs.find((pack) => pack.packId === "VN-PDPL");
    expect(vnPack).toBeDefined();

    // Simulate counsel having authored one rule by hand: strip the token
    // from its verificationNote and change its basis/treatment.
    const mutatedRules = vnPack!.categoryRules.map((rule, index) =>
      index === 0
        ? { ...rule, verificationNote: "Reviewed and authored by counsel.", basis: "Hand-authored basis text.", treatment: "ALLOW" as const }
        : rule
    );

    const releasedRule = mutatedRules[0]!;
    expect(releasedRule.verificationNote?.startsWith(UNAUTHORED_TOKEN)).toBe(false);

    const tokenBearing = tokenBearingRules(mutatedRules);
    expect(tokenBearing).toHaveLength(20); // 21 - the one released rule
    expect(tokenBearing.some((rule) => rule.categoryCode === releasedRule.categoryCode)).toBe(false);

    const generated = generateStubCategoryRules("VN-PDPL");
    const generatedByCode = new Map(generated.map((rule) => [rule.categoryCode, rule]));
    for (const rule of tokenBearing) {
      expect(rule).toEqual(generatedByCode.get(rule.categoryCode));
    }
  });

  it("blind-spot guard: a token-bearing rule whose packId is absent from PACK_JURISDICTIONS fails loudly rather than being silently skipped", () => {
    const unknownPackId = "ZZ-NOT-IN-TABLE";
    expect(PACK_JURISDICTIONS.some((row) => row.packId === unknownPackId)).toBe(false);

    // The drift test above relies on generateStubCategoryRules() itself
    // throwing (never returning undefined / an empty array) for a packId
    // it cannot regenerate — a silent skip here would protect nothing.
    expect(() => generateStubCategoryRules(unknownPackId)).toThrow(UnknownPackJurisdictionError);
  });

  it("the generator's emitted order equals EXPENSE_CATEGORY_CODES declaration order", () => {
    const generated = generateStubCategoryRules("VN-PDPL");
    expect(generated.map((rule) => rule.categoryCode)).toEqual([...EXPENSE_CATEGORY_CODES]);
  });
});

// 03-02 Task 1: proves each new jurisdiction is not just a PACK_JURISDICTIONS
// row (data the generator can already produce) but a committed, loadable
// pack — loadAllRulePacks() only ever sees what is on disk under
// packages/rulepacks/<packId>/, never the table itself. Scoped per-packId
// (not a total pack count) so it stays true after later tasks add more
// jurisdictions to the same table.
describe("PACK-10: newly committed jurisdictions load (03-02 Task 1)", () => {
  it("AU-PRIVACY-ACT is loadable with jurisdiction.code AU", () => {
    const pack = loadAllRulePacks().find((p) => p.packId === "AU-PRIVACY-ACT");
    expect(pack).toBeDefined();
    expect(pack!.jurisdiction.code).toBe("AU");
  });

  it("NZ-PRIVACY-ACT is loadable with jurisdiction.code NZ", () => {
    const pack = loadAllRulePacks().find((p) => p.packId === "NZ-PRIVACY-ACT");
    expect(pack).toBeDefined();
    expect(pack!.jurisdiction.code).toBe("NZ");
  });

  it("JP-APPI is loadable with jurisdiction.code JP", () => {
    const pack = loadAllRulePacks().find((p) => p.packId === "JP-APPI");
    expect(pack).toBeDefined();
    expect(pack!.jurisdiction.code).toBe("JP");
  });
});

// 03-02 Task 2: same pattern as Task 1, for South Korea, China and India.
describe("PACK-10: newly committed jurisdictions load (03-02 Task 2)", () => {
  it("KR-PIPA is loadable with jurisdiction.code KR", () => {
    const pack = loadAllRulePacks().find((p) => p.packId === "KR-PIPA");
    expect(pack).toBeDefined();
    expect(pack!.jurisdiction.code).toBe("KR");
  });

  it("CN-PIPL is loadable with jurisdiction.code CN", () => {
    const pack = loadAllRulePacks().find((p) => p.packId === "CN-PIPL");
    expect(pack).toBeDefined();
    expect(pack!.jurisdiction.code).toBe("CN");
  });

  it("IN-DPDP is loadable with jurisdiction.code IN", () => {
    const pack = loadAllRulePacks().find((p) => p.packId === "IN-DPDP");
    expect(pack).toBeDefined();
    expect(pack!.jurisdiction.code).toBe("IN");
  });
});
