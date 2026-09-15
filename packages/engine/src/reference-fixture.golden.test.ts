// packages/engine/src/reference-fixture.golden.test.ts
//
// PRD §14's reference fixture — build this first, per §14's own
// instruction; every formula in this phase is checked against its
// published numbers rather than against reasoning about the spec. Every
// expected value below is a literal, hand-transcribed from §14's table,
// compared with `toEqual`. This file deliberately contains no
// vitest snapshot matcher of any kind (the auto-updatable "matches the
// last recorded output" family) — §14's own point is that changing a pack
// must break its golden files, and a snapshot is designed to be
// regenerated with a CLI flag, which is the exact failure mode that
// instruction exists to prevent.
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
// Plan 02-06 extends this file further with §8.1 step 7's matter-level
// flags: REFERENCE_FIXTURE_PACK's matterFlagRules (three informational SG
// flags, reference-pack.ts) plus the derived LITIGATION_POSTURE (matter.
// isKnownDisputeOrLitigation is true) and STALE_PACK_WARNING (reviewDueOn is
// 16 days out, inside the 30-day window) — REPEAT_REQUEST and
// NO_FEE_AUTHORITY_POSTURE do not fire on this fixture (isRepeatRequest...
// is false; the posture is PERMITTED_REASONABLE, not NO_EXPRESS_AUTHORITY).
//
// Plan 02-05 extends this file with §8.1 steps 4 and 5: the cross-line
// checks (line 5 gains MATERIALITY alongside its existing CONDITIONS_NOT_MET
// — 450.00/888.00 is 50.7%, over the 40% threshold) and the aggregate cap
// (REFERENCE_FIXTURE_PACK's own aggregateCap stays null, so this fixture
// never exercises a binding cap — that is aggregate-cap.test.ts's job on its
// own dedicated fixture). The six published totals are re-asserted below to
// prove steps 4 and 5 moved nothing that PRD §14 didn't already specify.

import { describe, expect, it } from "vitest";
import { AssessmentSchema } from "@dsar/schemas/assessment";
import { ExpenseLineSchema, type ExpenseLine } from "@dsar/schemas/expense-line";
import type { RulePack } from "@dsar/schemas/rule-pack";
import type { Minor } from "@dsar/schemas/primitives";
import { assess } from "./assess.ts";
import { REFERENCE_LINE, REFERENCE_MATTER, REFERENCE_NOW, buildReferencePack } from "./__fixtures__/reference-matter.ts";
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

  it("line 5 (VENDOR_PAYROLL) carries CONDITIONS_NOT_MET and MATERIALITY — the vendor-evidence check stands down (its rule already tests isThirdPartyInvoiced)", () => {
    const result = runReferenceFixture();
    const line5 = result.lines[4];
    expect(line5?.flagReasons.map((reason) => reason.code)).toEqual(["CONDITIONS_NOT_MET", "MATERIALITY"]);
  });

  it("line 6 (OTHER_UNCLASSIFIED) carries UNCATEGORISED", () => {
    const result = runReferenceFixture();
    const line6 = result.lines[5];
    expect(line6?.flagReasons.map((reason) => reason.code)).toEqual(["UNCATEGORISED"]);
  });

  it("reproduces the exact per-line flag reason codes for every line — the full array of arrays, so an extra reason fails as loudly as a missing one", () => {
    const result = runReferenceFixture();
    expect(result.lines.map((line) => line.flagReasons.map((reason) => reason.code))).toEqual([
      [], // #1 STAFF_TIME_SEARCH — ALLOW
      [], // #2 STAFF_TIME_COLLATE — ALLOW
      [], // #3 STAFF_TIME_ASSESS_EXEMPTIONS — DISALLOW
      [], // #4 PHOTOCOPY_PRINT — ALLOW_CAPPED
      ["CONDITIONS_NOT_MET", "MATERIALITY"], // #5 VENDOR_PAYROLL — FLAG
      ["UNCATEGORISED"], // #6 OTHER_UNCLASSIFIED — FLAG
    ]);
  });

  it("re-reproduces the exact published totals — steps 4 and 5 moved nothing", () => {
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

  it("produces a schema-valid Assessment end to end", () => {
    const result = runReferenceFixture();
    expect(() => AssessmentSchema.parse(result)).not.toThrow();
  });

  it("reproduces the exact five matter-level flags — LITIGATION_POSTURE and STALE_PACK_WARNING (both requiring acknowledgement), plus the three informational SG pack flags", () => {
    const result = runReferenceFixture();

    expect(result.matterLevelFlags).toEqual([
      {
        id: "LITIGATION_POSTURE",
        code: "LITIGATION_POSTURE",
        message:
          "This requestor is in a known dispute with the company. A fee that is defensible in principle may still be unwise here, and may be characterised as obstructive. Confirm you have considered whether to charge at all.",
        requiresAcknowledgement: true,
      },
      {
        id: "STALE_PACK_WARNING",
        code: "STALE_PACK_WARNING",
        message:
          "The rule pack's review is due on '2026-10-01' (16 day(s) from now) — confirm the pack's current position before relying on this assessment.",
        requiresAcknowledgement: true,
      },
      {
        id: "SG.WRITTEN_ESTIMATE",
        code: "PACK_FLAG",
        message:
          "A written estimate of the fee must be given to the applicant before the fee is charged. If the eventual fee will exceed the estimate, a further written estimate is required.",
        requiresAcknowledgement: false,
      },
      {
        id: "SG.RESPOND_30_DAYS",
        code: "PACK_FLAG",
        message:
          "Respond within 30 days. If that is not possible, notify the applicant in writing of the time by which a response will be provided.",
        requiresAcknowledgement: false,
      },
      {
        id: "SG.NOT_A_DETERRENT",
        code: "PACK_FLAG",
        message:
          "The fee must be reasonable and must not be used to discourage the applicant from pursuing the request. The Commission may review the reasonableness of the fee.",
        requiresAcknowledgement: false,
      },
    ]);
  });

  it("matterLevelFlags is toEqual-identical across two consecutive assess() calls — the array's order is deterministic", () => {
    const first = runReferenceFixture();
    const second = runReferenceFixture();
    expect(first.matterLevelFlags).toEqual(second.matterLevelFlags);
  });
});

describe("§8.1 step 7 — the NO_FEE_AUTHORITY_POSTURE matter-level code", () => {
  it("fires alongside every line being flagged, under a NO_EXPRESS_AUTHORITY posture", () => {
    const noAuthorityPack: RulePack = {
      ...buildReferencePack(),
      feePosture: { PRIVATE_ORGANISATION: "NO_EXPRESS_AUTHORITY", PUBLIC_AGENCY: "NO_EXPRESS_AUTHORITY" },
    };

    const result = assess({
      matter: REFERENCE_MATTER,
      lines: [REFERENCE_LINE],
      pack: noAuthorityPack,
      now: REFERENCE_NOW,
    });

    expect(result.lines[0]?.verdict).toBe("FLAG");
    expect(result.lines[0]?.flagReasons.map((reason) => reason.code)).toEqual(["NO_FEE_AUTHORITY"]);
    expect(result.matterLevelFlags.some((flag) => flag.code === "NO_FEE_AUTHORITY_POSTURE")).toBe(true);
  });
});

describe("§8.1 steps 4/5 under a PROHIBITED posture", () => {
  it("produces no cross-line reasons — the posture gate short-circuits before step 4", () => {
    const prohibitedPack: RulePack = {
      ...buildReferencePack(),
      feePosture: { PRIVATE_ORGANISATION: "PROHIBITED", PUBLIC_AGENCY: "PROHIBITED" },
      // A ceiling far below REFERENCE_LINE's unitRate (4000) so rate sanity
      // would fire if the posture gate did not short-circuit step 4 first.
      rateSanityCeiling: { EXECUTIVE: 1 as Minor },
    };

    const result = assess({
      matter: REFERENCE_MATTER,
      lines: [REFERENCE_LINE],
      pack: prohibitedPack,
      now: REFERENCE_NOW,
    });

    expect(result.lines[0]?.verdict).toBe("DISALLOW");
    expect(result.lines[0]?.flagReasons).toEqual([]);
  });
});

describe("§8.1 step 4 — the ALLOW-to-FLAG materiality transition (untested by the §14 fixture itself)", () => {
  it("an ALLOW line pushed over the materiality threshold moves its claimed value from draftBaseline into flaggedTotal", () => {
    // A modified copy of the §14 fixture: line 1 (STAFF_TIME_SEARCH, ALLOW)
    // is inflated so it is >=40% of the new claimedTotal. The original
    // REFERENCE_FIXTURE_LINES array is never mutated — .map returns a new
    // array — so every other test in this file is unaffected.
    const modifiedLines: ExpenseLine[] = REFERENCE_FIXTURE_LINES.map((line, index) =>
      index === 0
        ? ExpenseLineSchema.parse({ ...line, quantity: 100, unitRate: 4000, claimedAmount: 400_000 })
        : line
    );

    const result = assess({
      matter: REFERENCE_MATTER,
      lines: modifiedLines,
      pack: REFERENCE_FIXTURE_PACK,
      now: REFERENCE_NOW,
    });

    const line1 = result.lines[0];
    expect(line1?.verdict).toBe("FLAG");
    expect(line1?.engineAmount).toBe(0);
    expect(line1?.flagReasons.map((reason) => reason.code)).toEqual(["MATERIALITY"]);

    // claimedTotal = 400000 + 8000 + 12000 + 3300 + 45000 + 4500 = 472800.
    // draftBaseline = line2 (8000) + line4 (2640) only — line1 dropped out.
    // disallowedTotal is unchanged (line3 claimed + line4's capped remainder).
    // flaggedTotal = line1 (400000) + line5 (45000) + line6 (4500).
    expect(result.totals.draftBaseline).toBe(10640);
    expect(result.totals.disallowedTotal).toBe(12660);
    expect(result.totals.flaggedTotal).toBe(449500);
  });
});
