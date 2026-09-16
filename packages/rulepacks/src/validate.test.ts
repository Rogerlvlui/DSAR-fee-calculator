// packages/rulepacks/src/validate.test.ts
//
// Task 2 (03-01-PLAN.md): proves the PACK-11 banned-word gate fires against
// a fixture it must catch (never inspecting a clean tree only), and proves
// a malformed pack fails at the parse boundary (PACK-01) rather than being
// caught and softened. Both fixtures live under src/__fixtures__/ and are
// loaded ONLY by explicit path here — loadAllRulePacks() never globs them
// (T-03-03), proven by the pack:validate CLI still exiting 0 with both
// fixtures committed.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadRulePackFile } from "./loader.ts";
import { RulePackValidationFailure, findBannedWord, validateAllRulePacks, validateRulePack } from "./validate.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "__fixtures__");

describe("validateAllRulePacks / validateRulePack (PACK-11)", () => {
  it("PACK-11: validateAllRulePacks() over the real packages/rulepacks tree throws nothing (the clean case)", () => {
    expect(() => validateAllRulePacks()).not.toThrow();
  });

  it("PACK-11: validateRulePack throws RulePackValidationFailure with code BANNED_WORD_IN_BASIS naming the offending ruleId, when a categoryRule's basis carries a banned word", () => {
    const fixturePath = path.join(FIXTURES_DIR, "banned-word-basis.fixture.json");
    const pack = loadRulePackFile(fixturePath);

    let caught: unknown;
    try {
      validateRulePack(pack);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(RulePackValidationFailure);
    const failure = caught as RulePackValidationFailure;
    expect(failure.code).toBe("BANNED_WORD_IN_BASIS");
    expect(failure.ruleId).toBe(pack.categoryRules[0]?.ruleId);
    expect(failure.message).toContain(pack.categoryRules[0]?.ruleId);
  });

  it("PACK-01: loadRulePackFile on the malformed fixture throws at the parse boundary, and the thrown value is NOT a RulePackValidationFailure", () => {
    const fixturePath = path.join(FIXTURES_DIR, "malformed.fixture.json");

    let caught: unknown;
    try {
      loadRulePackFile(fixturePath);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeDefined();
    expect(caught).not.toBeInstanceOf(RulePackValidationFailure);
  });

  it("an empty-string basis produces no violation and does not throw — emptiness is the UNAUTHORED token's business, never the banned-word scan's", () => {
    const fixturePath = path.join(FIXTURES_DIR, "banned-word-basis.fixture.json");
    const pack = loadRulePackFile(fixturePath);
    const emptyBasisRule = { ...pack.categoryRules[0]!, basis: "" };
    const cleanPack = { ...pack, categoryRules: [emptyBasisRule] };

    expect(() => validateRulePack(cleanPack)).not.toThrow();
    expect(findBannedWord("")).toBeNull();
  });

  it("findBannedWord returns null for a banned word written in Title case — proving the matcher is case-sensitive by construction, not by accident", () => {
    expect(findBannedWord("This outcome is Compliant with the applicable law.")).toBeNull();
  });
});
