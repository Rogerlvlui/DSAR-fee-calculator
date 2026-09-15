// packages/engine/src/posture-gate.test.ts
//
// PRD §8.1 step 2 — all seven FeePosture values, asserted individually so
// a future addition to FeePostureSchema without a matching test here is
// visible as a gap, not silently absorbed into a default expectation.

import { describe, expect, it } from "vitest";
import type { FeePosture } from "@dsar/schemas/rule-pack";
import { applyPostureGate } from "./posture-gate.ts";

describe("posture gate", () => {
  it("PROHIBITED forces every line to DISALLOW (AC-14)", () => {
    expect(applyPostureGate("PROHIBITED")).toEqual({ forced: true, verdict: "DISALLOW" });
  });

  it("PERMITTED_NARROW_EXCEPTION forces every line to DISALLOW (AC-14)", () => {
    expect(applyPostureGate("PERMITTED_NARROW_EXCEPTION")).toEqual({ forced: true, verdict: "DISALLOW" });
  });

  it("NO_EXPRESS_AUTHORITY forces every line to FLAG with NO_FEE_AUTHORITY (AC-13)", () => {
    expect(applyPostureGate("NO_EXPRESS_AUTHORITY")).toEqual({
      forced: true,
      verdict: "FLAG",
      flagReasonCode: "NO_FEE_AUTHORITY",
    });
  });

  const permittingPostures: FeePosture[] = [
    "PERMITTED_REASONABLE",
    "PERMITTED_NOT_EXCESSIVE",
    "PERMITTED_ACTUAL_COST",
    "PERMITTED_PRESCRIBED_CAP",
  ];

  for (const posture of permittingPostures) {
    it(`${posture} does not force a verdict — the per-line treatment table runs`, () => {
      expect(applyPostureGate(posture)).toEqual({ forced: false });
    });
  }
});
