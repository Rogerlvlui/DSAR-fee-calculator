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
import type { MatterFlagRule, RulePack } from "@dsar/schemas/rule-pack";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import { evaluatePackFlagRules } from "./matter-flags.ts";
import { REFERENCE_MATTER, buildReferencePack } from "./__fixtures__/reference-matter.ts";

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
