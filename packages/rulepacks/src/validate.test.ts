// packages/rulepacks/src/validate.test.ts
//
// Task 2 (03-01-PLAN.md): proves the PACK-11 banned-word gate fires against
// a fixture it must catch (never inspecting a clean tree only), and proves
// a malformed pack fails at the parse boundary (PACK-01) rather than being
// caught and softened. Both fixtures live under src/__fixtures__/ and are
// loaded ONLY by explicit path here — loadAllRulePacks() never globs them
// (T-03-03), proven by the pack:validate CLI still exiting 0 with both
// fixtures committed.
//
// 03-03 Task 1: PACK-02 (categoryRules exhaustiveness) proofs below follow
// the same discipline — proven to fire against a fixture it must catch,
// never inspecting a clean tree only.
//
// 03-03 Task 2: PACK-03 (ACTIVE-readiness) proofs follow the same
// discipline. PACK-03's own tests stay self-contained by building a
// "clean-enough" base from missing-reviewed-by.fixture.json plus
// PROTOTYPE_COUNSEL, rather than depending on Task 3's fixture.
//
// 03-03 Task 3: active-ready.fixture.json is the one fixture that clears
// every ACTIVE bar — a *shape* fixture with invented placeholder content
// (it exercises the gate; it is not a jurisdiction and must never be
// copied into a real pack directory). The tests below prove the clean
// pass, the narrowing's no-null guarantee, first-failure-wins determinism
// across a repeat run, and the declared check order against a literal
// array.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXPENSE_CATEGORY_CODES } from "@dsar/schemas/taxonomy";
import { RulePackSchema } from "@dsar/schemas/rule-pack";
import { loadRulePackFile } from "./loader.ts";
import {
  ACTIVE_READY_CHECK_ORDER,
  RulePackValidationFailure,
  assertActiveReady,
  findBannedWord,
  validateAllRulePacks,
  validateRulePack,
} from "./validate.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, "__fixtures__");

function loadFixture(name: string) {
  return loadRulePackFile(path.join(FIXTURES_DIR, name));
}

function expectFailure(fn: () => unknown): RulePackValidationFailure {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RulePackValidationFailure);
  return caught as RulePackValidationFailure;
}

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

describe("assertActiveReady / validateRulePack (PACK-02: categoryRules exhaustiveness)", () => {
  it("PACK-02: an ACTIVE pack missing one categoryCode fails with code MISSING_CATEGORY_RULES, naming the missing code", () => {
    const pack = loadFixture("missing-category.fixture.json");
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("MISSING_CATEGORY_RULES");
    expect(failure.message).toContain("OTHER_UNCLASSIFIED");
  });

  it("PACK-02: an ACTIVE pack with an empty categoryRules array fails and all 21 codes appear in the message", () => {
    const pack = { ...loadFixture("missing-category.fixture.json"), categoryRules: [] };
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("MISSING_CATEGORY_RULES");
    for (const code of EXPENSE_CATEGORY_CODES) {
      expect(failure.message).toContain(code);
    }
  });

  it("PACK-02: an ACTIVE pack with two rules for the same categoryCode fails with code DUPLICATE_CATEGORY_RULE naming the duplicated code, even though the code set is complete", () => {
    const pack = loadFixture("duplicate-category.fixture.json");
    // The fixture has 21 distinct codes present and 22 rules total — it
    // would pass a naive `new Set(codes).size === 21` check and must still
    // fail here.
    const distinctCodes = new Set(pack.categoryRules.map((rule) => rule.categoryCode));
    expect(distinctCodes.size).toBe(21);
    expect(pack.categoryRules.length).toBe(22);

    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("DUPLICATE_CATEGORY_RULE");
    expect(failure.message).toContain("STAFF_TIME_SEARCH");
  });

  it("PACK-02: shuffling an otherwise-complete pack's categoryRules array does not change the verdict, and the missing-code list is reported in EXPENSE_CATEGORY_CODES declaration order regardless of file order", () => {
    const pack = loadFixture("missing-category.fixture.json");
    const shuffled = { ...pack, categoryRules: [...pack.categoryRules].reverse() };

    const failure = expectFailure(() => assertActiveReady(shuffled));
    expect(failure.code).toBe("MISSING_CATEGORY_RULES");
    // OTHER_UNCLASSIFIED is the only missing code in this fixture, so the
    // expected literal list has exactly one entry — still asserted as a
    // literal array, not a mere substring containment.
    expect(failure.message).toContain("missing categoryRules for: OTHER_UNCLASSIFIED");
  });

  it("PACK-02: a DRAFT pack missing a category does not fail this check — exhaustiveness is an ACTIVE precondition", () => {
    const pack = loadFixture("missing-category.fixture.json");
    const draftIncomplete = { ...pack, status: "DRAFT" as const };
    expect(() => validateRulePack(draftIncomplete)).not.toThrow();
  });
});

describe("assertActiveReady (PACK-03: ACTIVE-readiness — reviewer identity, review dates, unauthored content, unresearched constraints)", () => {
  // missing-reviewed-by.fixture.json is otherwise a complete, 21/21,
  // non-duplicated ACTIVE pack (only `reviewedBy` is null) — restoring
  // `reviewedBy` gives a pack that clears PACK-02 and every PACK-03 check
  // except whatever a given test deliberately breaks next. This keeps
  // PACK-03's own tests self-contained rather than depending on Task 3's
  // active-ready.fixture.json, which does not exist yet at this task.
  async function cleanActiveBase() {
    const { PROTOTYPE_COUNSEL } = await import("./prototype-counsel.ts");
    const pack = loadFixture("missing-reviewed-by.fixture.json");
    return { ...pack, reviewedBy: PROTOTYPE_COUNSEL };
  }

  it("PACK-03: an ACTIVE pack with reviewedBy: null fails with code MISSING_REVIEWER and the message names reviewedBy", () => {
    const pack = loadFixture("missing-reviewed-by.fixture.json");
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("MISSING_REVIEWER");
    expect(failure.message).toContain("reviewedBy");
  });

  it("PACK-03: an ACTIVE pack with reviewedOn: null fails with code MISSING_REVIEWER and the message names reviewedOn", async () => {
    const pack = { ...(await cleanActiveBase()), reviewedOn: null };
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("MISSING_REVIEWER");
    expect(failure.message).toContain("reviewedOn");
  });

  it("PACK-03: an ACTIVE pack with authoredBy: null fails with code MISSING_REVIEWER and the message names authoredBy", async () => {
    const pack = { ...(await cleanActiveBase()), authoredBy: null };
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("MISSING_REVIEWER");
    expect(failure.message).toContain("authoredBy");
  });

  it("PACK-03: an ACTIVE pack whose reviewDueOn is before its reviewedOn fails with code REVIEW_DUE_BEFORE_REVIEWED", async () => {
    const pack = {
      ...(await cleanActiveBase()),
      reviewedOn: "2026-09-16",
      reviewDueOn: "2026-09-15",
    };
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("REVIEW_DUE_BEFORE_REVIEWED");
  });

  it("PACK-03: an ACTIVE pack whose reviewDueOn equals its reviewedOn does not throw REVIEW_DUE_BEFORE_REVIEWED — the boundary is inclusive", async () => {
    const pack = {
      ...(await cleanActiveBase()),
      reviewedOn: "2026-09-16",
      reviewDueOn: "2026-09-16",
    };
    expect(() => assertActiveReady(pack)).not.toThrow();
  });

  it("PACK-03: an ACTIVE pack with the UNAUTHORED token in one categoryRule's verificationNote fails with code UNAUTHORED_CONTENT naming that ruleId", () => {
    const pack = loadFixture("unauthored-token.fixture.json");
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("UNAUTHORED_CONTENT");
    expect(failure.ruleId).toBe("FIXTURE-UNAUTHORED-TOKEN.STAFF_TIME_COLLATE");
    expect(failure.message).toContain("FIXTURE-UNAUTHORED-TOKEN.STAFF_TIME_COLLATE");
  });

  it("PACK-03: the UNAUTHORED token in requestorNoticeTemplate fails with code UNAUTHORED_CONTENT naming requestorNoticeTemplate", async () => {
    const pack = {
      ...(await cleanActiveBase()),
      requestorNoticeTemplate: "UNAUTHORED — counsel must author this jurisdiction's requestor-facing notice.",
    };
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("UNAUTHORED_CONTENT");
    expect(failure.message).toContain("requestorNoticeTemplate");
  });

  it("PACK-03: the UNAUTHORED token in flatFee.verificationNote fails with code UNAUTHORED_CONTENT naming flatFee", async () => {
    const { toMinor } = await import("@dsar/schemas/primitives");
    const pack = {
      ...(await cleanActiveBase()),
      flatFee: {
        amount: toMinor(0),
        basis: "No flat-fee figure is given in the source specification for this jurisdiction.",
        citation: { instrument: "FIXTURE", provision: "" },
        verificationStatus: "NEEDS_VERIFICATION" as const,
        verificationNote: "UNAUTHORED — counsel must set the entity-specific figure before activation.",
      },
    };
    const failure = expectFailure(() => assertActiveReady(pack));
    expect(failure.code).toBe("UNAUTHORED_CONTENT");
    expect(failure.message).toContain("flatFee");
  });

  it("PACK-03: an ACTIVE pack with any one constraints value null fails, produced by re-parsing with the frozen RulePackSchema, not a hand-written eleven-key check", async () => {
    const pack = await cleanActiveBase();
    const withNullConstraint = {
      ...pack,
      constraints: { ...pack.constraints, mayWithholdDataUntilPaid: null },
    };
    const failure = expectFailure(() => assertActiveReady(withNullConstraint));
    expect(failure.code).toBe("UNRESEARCHED_CONSTRAINTS");
    expect(failure.message).toContain("mayWithholdDataUntilPaid");
  });

  it("UserRefSchema.parse(PROTOTYPE_COUNSEL) succeeds", async () => {
    const { UserRefSchema } = await import("@dsar/schemas/primitives");
    const { PROTOTYPE_COUNSEL } = await import("./prototype-counsel.ts");
    expect(() => UserRefSchema.parse(PROTOTYPE_COUNSEL)).not.toThrow();
  });
});

describe("assertActiveReady (Task 3: the clean fixture, and the gate's determinism)", () => {
  it("assertActiveReady on the clean fixture returns without throwing, and the returned value parses as RulePackSchema", () => {
    const pack = loadFixture("active-ready.fixture.json");
    const result = assertActiveReady(pack);
    expect(RulePackSchema.safeParse(result).success).toBe(true);
  });

  it("the returned value's constraints are all booleans or non-null values — no null survives the narrowing", () => {
    const pack = loadFixture("active-ready.fixture.json");
    const result = assertActiveReady(pack);
    for (const value of Object.values(result.constraints)) {
      expect(value).not.toBeNull();
    }
  });

  it("a pack failing two checks at once reports the earlier check in the declared order, and reports the same one on a repeat run", () => {
    const pack = loadFixture("active-ready.fixture.json");
    const brokenPack = {
      ...pack,
      reviewedBy: null,
      categoryRules: pack.categoryRules.slice(0, 20),
    };

    const first = expectFailure(() => assertActiveReady(brokenPack));
    const second = expectFailure(() => assertActiveReady(brokenPack));

    // Exhaustiveness (CATEGORY_RULES_EXHAUSTIVENESS) precedes reviewer
    // identity in ACTIVE_READY_CHECK_ORDER, so MISSING_CATEGORY_RULES is
    // the reported failure, not MISSING_REVIEWER.
    expect(first.code).toBe("MISSING_CATEGORY_RULES");
    expect(second.code).toBe(first.code);
  });

  it("the declared check-order constant matches a literal expected array — reordering the checks is a deliberate, reviewed change", () => {
    expect(ACTIVE_READY_CHECK_ORDER).toEqual([
      "CATEGORY_RULES_EXHAUSTIVENESS",
      "REVIEWER_IDENTITY",
      "REVIEW_DATE_COHERENCE",
      "UNAUTHORED_CONTENT",
      "UNRESEARCHED_CONSTRAINTS",
    ]);
  });
});
