// packages/engine/src/assess.tracer.test.ts
//
// Task 1's tracer: one ALLOW-treatment expense line traveling through every
// layer assess() will ever have — preconditions, per-line evaluation,
// totals, Assessment assembly — proven schema-valid via
// AssessmentSchema.parse() rather than trusted from the TypeScript return
// type (02-CONTEXT.md: "an architectural mistake in the Assessment
// construction surfaces after one commit rather than after six").

import { describe, expect, it } from "vitest";
import { AssessmentSchema } from "@dsar/schemas/assessment";
import { assess } from "./assess.ts";
import {
  buildReferencePack,
  REFERENCE_LINE,
  REFERENCE_MATTER,
  REFERENCE_NOW,
} from "./__fixtures__/reference-matter.ts";

describe("assess() — Task 1 tracer: one ALLOW line end to end", () => {
  it("returns a schema-valid Assessment for a single ALLOW line", () => {
    const pack = buildReferencePack();
    const result = assess({
      matter: REFERENCE_MATTER,
      lines: [REFERENCE_LINE],
      pack,
      now: REFERENCE_NOW,
    });

    expect(() => AssessmentSchema.parse(result)).not.toThrow();

    expect(result.lines).toHaveLength(1);
    const [line] = result.lines;
    expect(line?.verdict).toBe("ALLOW");
    expect(line?.engineAmount).toBe(16000);
    expect(line?.flagReasons).toEqual([]);
    expect(line?.disposition).toBe("PENDING");
    expect(line?.appliedRuleId).toBe(pack.categoryRules[0]?.ruleId);
    expect(line?.basis).toBe(pack.categoryRules[0]?.basis);
    expect(line?.citation).toEqual(pack.categoryRules[0]?.citation);

    expect(result.totals).toEqual({
      claimedTotal: 16000,
      draftBaseline: 16000,
      disallowedTotal: 0,
      flaggedTotal: 0,
      restingOnUnverifiedRules: 0,
      finalAmount: null,
    });
  });

  it("moves the line's amount into restingOnUnverifiedRules — a subset of draftBaseline, not an addition — when the applied rule is NEEDS_VERIFICATION", () => {
    const pack = buildReferencePack({ categoryRule: { verificationStatus: "NEEDS_VERIFICATION" } });
    const result = assess({
      matter: REFERENCE_MATTER,
      lines: [REFERENCE_LINE],
      pack,
      now: REFERENCE_NOW,
    });

    expect(result.totals.draftBaseline).toBe(16000);
    expect(result.totals.restingOnUnverifiedRules).toBe(16000);
  });

  it("is deterministic — identical input produces deeply equal output", () => {
    const pack = buildReferencePack();
    const first = assess({ matter: REFERENCE_MATTER, lines: [REFERENCE_LINE], pack, now: REFERENCE_NOW });
    const second = assess({ matter: REFERENCE_MATTER, lines: [REFERENCE_LINE], pack, now: REFERENCE_NOW });
    expect(first).toEqual(second);
  });
});
