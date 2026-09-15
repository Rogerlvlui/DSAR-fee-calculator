// packages/engine/src/reference-fixture.golden.test.ts
//
// PRD §14's reference fixture — build this first, per §14's own
// instruction; every formula in this phase is checked against its
// published numbers rather than against reasoning about the spec. Every
// expected value below is a literal, hand-transcribed from §14's table,
// compared with `toEqual` — never `toMatchSnapshot`/`toMatchInlineSnapshot`
// anywhere in this file. §14's own point is that changing a pack must
// break its golden files; a snapshot is designed to be regenerated with a
// flag, which is the exact failure mode that instruction exists to
// prevent.
//
// The two figures most likely to regress, and what their failure looks
// like (02-RESEARCH.md Pitfalls 1 and 3):
//   - disallowedTotal 12000 (not 12660) means the ALLOW_CAPPED line's
//     cap-trimmed remainder (660, from claimedAmount − engineAmount) was
//     dropped from the formula — disallowedTotal is not merely the sum of
//     DISALLOW lines.
//   - restingOnUnverifiedRules 26640 (not 10640) means every rule in the
//     fixture was marked NEEDS_VERIFICATION — copying §7.6's description of
//     the REAL SG-PDPA production pack into this fixture, rather than the
//     specific per-rule statuses this fixture actually needs (only
//     STAFF_TIME_COLLATE and PHOTOCOPY_PRINT are NEEDS_VERIFICATION here;
//     STAFF_TIME_SEARCH is VERIFIED).
//
// Matter flags and cross-line flag reasons (MATERIALITY, POSSIBLE_DUPLICATE,
// RATE_ABOVE_EXPECTED, VENDOR_EVIDENCE_MISSING, the aggregate cap, and
// LITIGATION_POSTURE/REPEAT_REQUEST/STALE_PACK_WARNING) are plans 02-05 and
// 02-06's, which extend this same file — not asserted here.

import { describe, expect, it } from "vitest";
import { AssessmentSchema } from "@dsar/schemas/assessment";
import { assess } from "./assess.ts";
import { REFERENCE_MATTER, REFERENCE_NOW } from "./__fixtures__/reference-matter.ts";
import { REFERENCE_FIXTURE_PACK } from "./__fixtures__/reference-pack.ts";
import { REFERENCE_FIXTURE_LINES } from "./__fixtures__/reference-lines.ts";

function runReferenceFixture() {
  return assess({
    matter: REFERENCE_MATTER,
    lines: REFERENCE_FIXTURE_LINES,
    pack: REFERENCE_FIXTURE_PACK,
    now: REFERENCE_NOW,
  });
}

describe("PRD §14 reference fixture (SG-shaped)", () => {
  it("reproduces the six published per-line verdicts and engine amounts exactly", () => {
    const result = runReferenceFixture();

    expect(result.lines.map((line) => ({ verdict: line.verdict, engineAmount: line.engineAmount }))).toEqual([
      { verdict: "ALLOW", engineAmount: 16000 }, // #1 STAFF_TIME_SEARCH — 160.00
      { verdict: "ALLOW", engineAmount: 8000 }, // #2 STAFF_TIME_COLLATE — 80.00
      { verdict: "DISALLOW", engineAmount: 0 }, // #3 STAFF_TIME_ASSESS_EXEMPTIONS
      { verdict: "ALLOW_CAPPED", engineAmount: 2640 }, // #4 PHOTOCOPY_PRINT — 26.40
      { verdict: "FLAG", engineAmount: 0 }, // #5 VENDOR_PAYROLL
      { verdict: "FLAG", engineAmount: 0 }, // #6 OTHER_UNCLASSIFIED
    ]);
  });

  it("reproduces the exact published totals — claimedTotal 888.00, draftBaseline 266.40, disallowedTotal 126.60, flaggedTotal 495.00, restingOnUnverifiedRules 106.40, finalAmount null", () => {
    const result = runReferenceFixture();

    expect(result.totals).toEqual({
      claimedTotal: 88800,
      draftBaseline: 26640,
      disallowedTotal: 12660,
      flaggedTotal: 49500,
      restingOnUnverifiedRules: 10640,
      finalAmount: null,
    });
  });

  it("line 5 (VENDOR_PAYROLL) carries CONDITIONS_NOT_MET", () => {
    const result = runReferenceFixture();
    const line5 = result.lines[4];
    expect(line5?.flagReasons.map((reason) => reason.code)).toEqual(["CONDITIONS_NOT_MET"]);
  });

  it("line 6 (OTHER_UNCLASSIFIED) carries UNCATEGORISED", () => {
    const result = runReferenceFixture();
    const line6 = result.lines[5];
    expect(line6?.flagReasons.map((reason) => reason.code)).toEqual(["UNCATEGORISED"]);
  });

  it("produces a schema-valid Assessment end to end", () => {
    const result = runReferenceFixture();
    expect(() => AssessmentSchema.parse(result)).not.toThrow();
  });
});
