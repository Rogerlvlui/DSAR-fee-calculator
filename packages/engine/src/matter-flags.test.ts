// packages/engine/src/matter-flags.test.ts
//
// PRD §8.1 step 7 / ENGINE-11 (Task 1) — evaluatePackFlagRules() over all
// three matterFlagRule `when` arms (always, condition, line-count), each
// with a matching and a non-matching case; requiresAcknowledgement sourced
// from the rule (including a false case); an unrecognised `when` shape
// throwing rather than silently producing no flag (T-2-23); and every
// produced flag parsed through MatterFlagSchema.
//
// Task 2 extends this file with the derived matter flags and the full
// composition (composeMatterLevelFlags) — not asserted here.

import { describe, expect, it } from "vitest";
import { MatterFlagSchema } from "@dsar/schemas/primitives";
import type { Matter } from "@dsar/schemas/matter";
import type { MatterFlagRule, RulePack } from "@dsar/schemas/rule-pack";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import {
  composeMatterLevelFlags,
  computeDerivedMatterFlags,
  DERIVED_MATTER_FLAG_ORDER,
  evaluatePackFlagRules,
} from "./matter-flags.ts";
import { REFERENCE_MATTER, REFERENCE_NOW, buildReferencePack } from "./__fixtures__/reference-matter.ts";

interface RawExpenseLineInput {
  id?: string;
  quantity?: number;
  unit?: string;
  unitRateNumber?: number;
  isThirdPartyInvoiced?: boolean;
}

function buildExpenseLine(overrides: RawExpenseLineInput = {}): ExpenseLine {
  const quantity = overrides.quantity ?? 1;
  const unitRateNumber = overrides.unitRateNumber ?? 1000;
  return ExpenseLineSchema.parse({
    id: overrides.id ?? "expense-line",
    matterId: REFERENCE_MATTER.id,
    seq: 0,
    categoryCode: "STAFF_TIME_SEARCH",
    description: "Test expense line",
    quantity,
    unit: overrides.unit ?? "HOUR",
    unitRate: unitRateNumber,
    claimedAmount: quantity * unitRateNumber,
    incurredByGrade: null,
    isThirdPartyInvoiced: overrides.isThirdPartyInvoiced ?? false,
    vendorName: null,
    evidenceRef: null,
    hrNote: null,
  });
}

function buildPack(matterFlagRules: MatterFlagRule[]): RulePack {
  return { ...buildReferencePack(), matterFlagRules };
}

describe("matterFlagRules — evaluatePackFlagRules", () => {
  it("an always-arm rule produces a flag on every matter", () => {
    const pack = buildPack([
      { flagId: "TEST.ALWAYS", when: { always: true }, message: "Always fires.", requiresAcknowledgement: false },
    ]);
    const flags = evaluatePackFlagRules(pack, REFERENCE_MATTER, [buildExpenseLine()]);
    expect(flags).toEqual([
      { id: "TEST.ALWAYS", code: "PACK_FLAG", message: "Always fires.", requiresAcknowledgement: false },
    ]);
  });

  it("a condition-arm rule over a matter field fires when the condition holds and stands down when it does not", () => {
    const rule: MatterFlagRule = {
      flagId: "TEST.DISPUTE",
      when: { field: "isKnownDisputeOrLitigation", op: "eq", value: true },
      message: "Dispute-only rule.",
      requiresAcknowledgement: false,
    };
    const disputeMatter = { ...REFERENCE_MATTER, isKnownDisputeOrLitigation: true };
    const noDisputeMatter = { ...REFERENCE_MATTER, isKnownDisputeOrLitigation: false };

    expect(evaluatePackFlagRules(buildPack([rule]), disputeMatter, [buildExpenseLine()])).toHaveLength(1);
    expect(evaluatePackFlagRules(buildPack([rule]), noDisputeMatter, [buildExpenseLine()])).toHaveLength(0);
  });

  it("a condition-arm rule over a line field fires if ANY line matches, not only if every line matches", () => {
    const rule: MatterFlagRule = {
      flagId: "TEST.THIRD_PARTY",
      when: { field: "isThirdPartyInvoiced", op: "eq", value: true },
      message: "At least one third-party line.",
      requiresAcknowledgement: false,
    };
    const someMatchLines = [
      buildExpenseLine({ id: "line-1", isThirdPartyInvoiced: false }),
      buildExpenseLine({ id: "line-2", isThirdPartyInvoiced: true }),
    ];
    expect(evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, someMatchLines)).toHaveLength(1);

    const noMatchLines = [
      buildExpenseLine({ id: "line-1", isThirdPartyInvoiced: false }),
      buildExpenseLine({ id: "line-2", isThirdPartyInvoiced: false }),
    ];
    expect(evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, noMatchLines)).toHaveLength(0);
  });

  it("a line-count arm with 'gte' fires inclusively at the boundary", () => {
    const rule: MatterFlagRule = {
      flagId: "TEST.MANY_LINES",
      when: { field: "lineCount", op: "gte", value: 3 },
      message: "Three or more lines.",
      requiresAcknowledgement: false,
    };
    const threeLines = [
      buildExpenseLine({ id: "a" }),
      buildExpenseLine({ id: "b" }),
      buildExpenseLine({ id: "c" }),
    ];
    const twoLines = threeLines.slice(0, 2);
    expect(evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, threeLines)).toHaveLength(1);
    expect(evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, twoLines)).toHaveLength(0);
  });

  it("a line-count arm with 'lte' fires inclusively at the boundary", () => {
    const rule: MatterFlagRule = {
      flagId: "TEST.FEW_LINES",
      when: { field: "lineCount", op: "lte", value: 2 },
      message: "Two or fewer lines.",
      requiresAcknowledgement: false,
    };
    const twoLines = [buildExpenseLine({ id: "a" }), buildExpenseLine({ id: "b" })];
    const threeLines = [...twoLines, buildExpenseLine({ id: "c" })];
    expect(evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, twoLines)).toHaveLength(1);
    expect(evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, threeLines)).toHaveLength(0);
  });

  it("requiresAcknowledgement comes from the rule, not a default — including a false case", () => {
    const trueRule: MatterFlagRule = {
      flagId: "TEST.ACK_TRUE",
      when: { always: true },
      message: "m",
      requiresAcknowledgement: true,
    };
    const falseRule: MatterFlagRule = {
      flagId: "TEST.ACK_FALSE",
      when: { always: true },
      message: "m",
      requiresAcknowledgement: false,
    };
    const flags = evaluatePackFlagRules(buildPack([trueRule, falseRule]), REFERENCE_MATTER, [buildExpenseLine()]);
    expect(flags.map((flag) => flag.requiresAcknowledgement)).toEqual([true, false]);
  });

  it("two matching rules produce two flags in the order the rules appear in the pack", () => {
    const first: MatterFlagRule = {
      flagId: "TEST.FIRST",
      when: { always: true },
      message: "first",
      requiresAcknowledgement: false,
    };
    const second: MatterFlagRule = {
      flagId: "TEST.SECOND",
      when: { always: true },
      message: "second",
      requiresAcknowledgement: false,
    };
    const flags = evaluatePackFlagRules(buildPack([first, second]), REFERENCE_MATTER, [buildExpenseLine()]);
    expect(flags.map((flag) => flag.id)).toEqual(["TEST.FIRST", "TEST.SECOND"]);
  });

  it("a pack with no matterFlagRules produces no pack flags and does not throw", () => {
    expect(() => evaluatePackFlagRules(buildPack([]), REFERENCE_MATTER, [buildExpenseLine()])).not.toThrow();
    expect(evaluatePackFlagRules(buildPack([]), REFERENCE_MATTER, [buildExpenseLine()])).toEqual([]);
  });

  it("every produced flag parses through MatterFlagSchema", () => {
    const rule: MatterFlagRule = {
      flagId: "TEST.PARSE",
      when: { always: true },
      message: "parses",
      requiresAcknowledgement: true,
    };
    const flags = evaluatePackFlagRules(buildPack([rule]), REFERENCE_MATTER, [buildExpenseLine()]);
    for (const flag of flags) {
      expect(() => MatterFlagSchema.parse(flag)).not.toThrow();
    }
  });

  it("an unrecognised 'when' shape throws rather than producing no flag", () => {
    const malformedRule = {
      flagId: "TEST.MALFORMED",
      when: { foo: "bar" } as unknown as MatterFlagRule["when"],
      message: "should never fire silently",
      requiresAcknowledgement: false,
    };
    expect(() =>
      evaluatePackFlagRules(buildPack([malformedRule]), REFERENCE_MATTER, [buildExpenseLine()])
    ).toThrow();
  });
});

// Task 2 — the four derived matter-flag codes and the full array
// composition (ENGINE-11, §8.1 step 7's second half).
describe("matter flags — derived and composed", () => {
  function matterWith(overrides: Partial<Matter>): Matter {
    return { ...REFERENCE_MATTER, ...overrides };
  }

  it("LITIGATION_POSTURE fires when isKnownDisputeOrLitigation is true, requiring acknowledgement", () => {
    const disputeMatter = matterWith({ isKnownDisputeOrLitigation: true });
    const flags = computeDerivedMatterFlags(disputeMatter, buildReferencePack(), REFERENCE_NOW);
    const flag = flags.find((f) => f.code === "LITIGATION_POSTURE");
    expect(flag).toBeDefined();
    expect(flag?.requiresAcknowledgement).toBe(true);
  });

  it("LITIGATION_POSTURE is absent when isKnownDisputeOrLitigation is false", () => {
    const noDisputeMatter = matterWith({ isKnownDisputeOrLitigation: false });
    const flags = computeDerivedMatterFlags(noDisputeMatter, buildReferencePack(), REFERENCE_NOW);
    expect(flags.find((f) => f.code === "LITIGATION_POSTURE")).toBeUndefined();
  });

  it("REPEAT_REQUEST fires when isRepeatRequestWithin12Months is true, NOT requiring acknowledgement", () => {
    const repeatMatter = matterWith({ isRepeatRequestWithin12Months: true, isKnownDisputeOrLitigation: false });
    const flags = computeDerivedMatterFlags(repeatMatter, buildReferencePack(), REFERENCE_NOW);
    const flag = flags.find((f) => f.code === "REPEAT_REQUEST");
    expect(flag).toBeDefined();
    expect(flag?.requiresAcknowledgement).toBe(false);
  });

  it("REPEAT_REQUEST is absent when isRepeatRequestWithin12Months is false", () => {
    const notRepeatMatter = matterWith({ isRepeatRequestWithin12Months: false });
    const flags = computeDerivedMatterFlags(notRepeatMatter, buildReferencePack(), REFERENCE_NOW);
    expect(flags.find((f) => f.code === "REPEAT_REQUEST")).toBeUndefined();
  });

  it("STALE_PACK_WARNING fires at exactly 30 days from reviewDueOn, requiring acknowledgement", () => {
    const packDueIn30Days: RulePack = { ...buildReferencePack(), reviewDueOn: "2026-10-15" };
    const flags = computeDerivedMatterFlags(REFERENCE_MATTER, packDueIn30Days, REFERENCE_NOW);
    const flag = flags.find((f) => f.code === "STALE_PACK_WARNING");
    expect(flag).toBeDefined();
    expect(flag?.requiresAcknowledgement).toBe(true);
  });

  it("STALE_PACK_WARNING does NOT fire at 31 days from reviewDueOn", () => {
    const packDueIn31Days: RulePack = { ...buildReferencePack(), reviewDueOn: "2026-10-16" };
    const flags = computeDerivedMatterFlags(REFERENCE_MATTER, packDueIn31Days, REFERENCE_NOW);
    expect(flags.find((f) => f.code === "STALE_PACK_WARNING")).toBeUndefined();
  });

  it("NO_FEE_AUTHORITY_POSTURE fires when the pack's posture for the matter's controllerType is NO_EXPRESS_AUTHORITY", () => {
    const noAuthorityPack: RulePack = {
      ...buildReferencePack(),
      feePosture: { PRIVATE_ORGANISATION: "NO_EXPRESS_AUTHORITY", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    };
    const flags = computeDerivedMatterFlags(REFERENCE_MATTER, noAuthorityPack, REFERENCE_NOW);
    const flag = flags.find((f) => f.code === "NO_FEE_AUTHORITY_POSTURE");
    expect(flag).toBeDefined();
    expect(flag?.requiresAcknowledgement).toBe(false);
  });

  it("NO_FEE_AUTHORITY_POSTURE is absent under a permitting posture", () => {
    const flags = computeDerivedMatterFlags(REFERENCE_MATTER, buildReferencePack(), REFERENCE_NOW);
    expect(flags.find((f) => f.code === "NO_FEE_AUTHORITY_POSTURE")).toBeUndefined();
  });

  it("the derived-flag order is a declared constant: LITIGATION_POSTURE, REPEAT_REQUEST, STALE_PACK_WARNING, NO_FEE_AUTHORITY_POSTURE", () => {
    expect(DERIVED_MATTER_FLAG_ORDER).toEqual([
      "LITIGATION_POSTURE",
      "REPEAT_REQUEST",
      "STALE_PACK_WARNING",
      "NO_FEE_AUTHORITY_POSTURE",
    ]);
  });

  it("computeDerivedMatterFlags produces flags in DERIVED_MATTER_FLAG_ORDER's order when several fire at once", () => {
    const allFireMatter = matterWith({ isKnownDisputeOrLitigation: true, isRepeatRequestWithin12Months: true });
    const allFirePack: RulePack = {
      ...buildReferencePack(),
      reviewDueOn: "2026-10-15",
      feePosture: { PRIVATE_ORGANISATION: "NO_EXPRESS_AUTHORITY", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    };
    const flags = computeDerivedMatterFlags(allFireMatter, allFirePack, REFERENCE_NOW);
    expect(flags.map((f) => f.code)).toEqual([
      "LITIGATION_POSTURE",
      "REPEAT_REQUEST",
      "STALE_PACK_WARNING",
      "NO_FEE_AUTHORITY_POSTURE",
    ]);
  });

  it("composeMatterLevelFlags orders derived flags, then the aggregate-cap flag, then pack flags", () => {
    const derivedFlags = [
      { id: "LITIGATION_POSTURE", code: "LITIGATION_POSTURE" as const, message: "d", requiresAcknowledgement: true },
    ];
    const aggregateCapFlag = {
      id: "AGGREGATE_CAP_APPLIED",
      code: "AGGREGATE_CAP_APPLIED" as const,
      message: "cap",
      requiresAcknowledgement: true,
    };
    const packFlags = [
      { id: "SG.WRITTEN_ESTIMATE", code: "PACK_FLAG" as const, message: "p", requiresAcknowledgement: false },
    ];
    const composed = composeMatterLevelFlags({ derivedFlags, aggregateCapFlag, packFlags });
    expect(composed.map((f) => f.id)).toEqual(["LITIGATION_POSTURE", "AGGREGATE_CAP_APPLIED", "SG.WRITTEN_ESTIMATE"]);
  });

  it("composeMatterLevelFlags omits the aggregate-cap flag entirely when null", () => {
    const composed = composeMatterLevelFlags({ derivedFlags: [], aggregateCapFlag: null, packFlags: [] });
    expect(composed).toEqual([]);
  });

  it("two consecutive computeDerivedMatterFlags calls over the same input produce toEqual-identical arrays", () => {
    const pack = buildReferencePack();
    const first = computeDerivedMatterFlags(REFERENCE_MATTER, pack, REFERENCE_NOW);
    const second = computeDerivedMatterFlags(REFERENCE_MATTER, pack, REFERENCE_NOW);
    expect(first).toEqual(second);
  });
});
