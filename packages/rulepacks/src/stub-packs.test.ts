// packages/rulepacks/src/stub-packs.test.ts
//
// PACK-10: the whole stub set's shape, asserted together rather than pack
// by pack. Every assertion drives off loadAllRulePacks() and
// PACK_JURISDICTIONS — never a hardcoded list of seven packIds — so an
// eighth stub added without a table row (or a table row added without a
// committed directory) fails loudly instead of passing unnoticed
// (03-02-PLAN.md Task 3 action).
//
// Every per-stub assertion selects packs by `packKind === "stub"`, never
// "everything in PACK_JURISDICTIONS" — plan 03-05 adds HK-PDPO/SG-PDPA rows
// with `packKind: "authored"` to the SAME table, and those packs legitimately
// do not satisfy an all-null-constraints / all-FLAG / UNAUTHORED_TOKEN check.

import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { UNAUTHORED_TOKEN } from "@dsar/schemas/constants";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import { loadAllRulePacks, RULEPACKS_ROOT } from "./loader.ts";
import { PACK_JURISDICTIONS } from "./stub-category-rules.ts";

// Mirrors loader.ts's own NON_PACK_DIRECTORIES set (loader.ts is not the
// place to export it just for this test — it is a fixed, small constant, and
// loader.test.ts's PACK-01 test already re-derives it the same way).
const NON_PACK_DIRECTORIES = new Set(["src", "scripts", "node_modules", "dist"]);

function committedPackDirNames(): string[] {
  return readdirSync(RULEPACKS_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NON_PACK_DIRECTORIES.has(entry.name))
    .map((entry) => entry.name);
}

function stubRows() {
  return PACK_JURISDICTIONS.filter((row) => row.packKind === "stub");
}

describe("PACK-10: the whole stub set's shape", () => {
  it('every PACK_JURISDICTIONS row has a committed pack directory (no row is missing its file)', () => {
    const dirNames = new Set(committedPackDirNames());
    const missingDirs = PACK_JURISDICTIONS.map((row) => row.packId).filter((id) => !dirNames.has(id));
    expect(missingDirs).toEqual([]);
  });

  it('every committed pack directory has a PACK_JURISDICTIONS row (no stray directory is untracked by the table)', () => {
    const tableIds = new Set(PACK_JURISDICTIONS.map((row) => row.packId));
    const missingRows = committedPackDirNames().filter((name) => !tableIds.has(name));
    expect(missingRows).toEqual([]);
  });

  it("exactly seven rows carry packKind: \"stub\"", () => {
    expect(stubRows()).toHaveLength(7);
  });

  it("each stub pack's status is DRAFT", () => {
    const packs = loadAllRulePacks();
    for (const row of stubRows()) {
      const pack = packs.find((p) => p.packId === row.packId);
      expect(pack).toBeDefined();
      expect(pack!.status).toBe("DRAFT");
    }
  });

  it("each stub pack has exactly 21 categoryRules, no duplicate categoryCode, and the set of categoryCodes equals EXPENSE_CATEGORY_CODES", () => {
    const packs = loadAllRulePacks();
    for (const row of stubRows()) {
      const pack = packs.find((p) => p.packId === row.packId)!;
      expect(pack.categoryRules).toHaveLength(21);
      const codes = pack.categoryRules.map((rule) => rule.categoryCode);
      expect(new Set(codes).size).toBe(21);
      expect(new Set(codes)).toEqual(new Set(EXPENSE_CATEGORY_CODES));
    }
  });

  it("each stub pack's categoryCodes appear in EXPENSE_CATEGORY_CODES declaration order", () => {
    const packs = loadAllRulePacks();
    for (const row of stubRows()) {
      const pack = packs.find((p) => p.packId === row.packId)!;
      expect(pack.categoryRules.map((rule) => rule.categoryCode)).toEqual([...EXPENSE_CATEGORY_CODES]);
    }
  });

  it("every stub categoryRule is FLAG/NEEDS_VERIFICATION with a verificationNote starting with UNAUTHORED_TOKEN", () => {
    const packs = loadAllRulePacks();
    for (const row of stubRows()) {
      const pack = packs.find((p) => p.packId === row.packId)!;
      for (const rule of pack.categoryRules) {
        expect(rule.treatment).toBe("FLAG");
        expect(rule.verificationStatus).toBe("NEEDS_VERIFICATION");
        expect(rule.verificationNote?.startsWith(UNAUTHORED_TOKEN)).toBe(true);
      }
    }
  });

  it("every stub pack's eleven constraints are null, matterFlagRules is empty, rateSanityCeiling has no keys, and no flatFee key is present", () => {
    const packs = loadAllRulePacks();
    for (const row of stubRows()) {
      // Read via loadAllRulePacks()/loadRulePackFile's parsed result (the
      // single load boundary, PACK-01) — key ABSENCE checked with `in`
      // rather than `=== undefined`, since the frozen schema makes
      // `flatFee` optional precisely so a pack without one omits the key
      // entirely (RulePackSchema module comment).
      const pack = packs.find((p) => p.packId === row.packId)!;
      const constraintValues = Object.values(pack.constraints);
      expect(constraintValues).toHaveLength(11);
      for (const value of constraintValues) {
        expect(value).toBeNull();
      }
      expect(pack.matterFlagRules).toEqual([]);
      expect(Object.keys(pack.rateSanityCeiling)).toHaveLength(0);
      expect("flatFee" in pack).toBe(false);
    }
  });

  it("summed across the seven stub packs there are exactly 147 categoryRules", () => {
    const packs = loadAllRulePacks();
    const total = stubRows().reduce((sum, row) => {
      const pack = packs.find((p) => p.packId === row.packId)!;
      return sum + pack.categoryRules.length;
    }, 0);
    // Asserted as a literal number, not `stubRows().length * 21` — a
    // regression that drops a rule from one pack while another pack gains
    // one elsewhere would cancel out under a computed total and pass
    // vacuously. 21 * 7 = 147.
    expect(total).toBe(147);
  });

  it("every ruleId across the whole committed tree is unique and equals `${packId}.${categoryCode}`", () => {
    const packs = loadAllRulePacks();
    const seen = new Set<string>();
    for (const pack of packs) {
      for (const rule of pack.categoryRules) {
        expect(rule.ruleId).toBe(`${pack.packId}.${rule.categoryCode}`);
        expect(seen.has(rule.ruleId)).toBe(false);
        seen.add(rule.ruleId);
      }
    }
  });
});
