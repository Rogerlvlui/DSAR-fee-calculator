// packages/schemas/src/guard-input.test.ts
//
// GuardInput's value is almost entirely at compile time (SCHEMA-06 /
// AC-15b) — the `@ts-expect-error` fixture below is what the plan's
// `tsc --noEmit` verify step actually checks. The runtime assertions here
// only confirm the guard-visible members are readable and that `pack` may
// be null; neither is exercised by typechecking alone.

import { describe, expect, it } from "vitest";
import type { GuardInput } from "./guard-input.ts";

function sampleGuardInput(): GuardInput {
  return {
    matterStatus: "LEGAL_REVIEW",
    expenseLineCount: 6,
    jurisdictionCode: "SG",
    currency: "SGD",
    controllerType: "PRIVATE_ORGANISATION",
    pack: { status: "ACTIVE", reviewDueOn: "2027-01-01", appliesTo: ["PRIVATE_ORGANISATION"] },
    attestationsAddressed: true,
    pendingLineCount: 0,
    matterLevelFlagsRequiringAck: ["LITIGATION_POSTURE"],
    acknowledgedFlags: ["LITIGATION_POSTURE"],
    lawyerIdentity: null,
  };
}

describe("GuardInput — guard-visible members", () => {
  it("a guard function reading matterStatus, expenseLineCount, pendingLineCount and pack.reviewDueOn compiles and reads correctly", () => {
    function sampleGuard(input: GuardInput): boolean {
      return (
        input.matterStatus === "LEGAL_REVIEW" &&
        input.expenseLineCount > 0 &&
        input.pendingLineCount === 0 &&
        input.pack?.reviewDueOn !== undefined
      );
    }
    expect(sampleGuard(sampleGuardInput())).toBe(true);
  });

  it("pack may be null, expressing 'no usable pack for this jurisdiction'", () => {
    const input: GuardInput = { ...sampleGuardInput(), pack: null };
    expect(input.pack).toBeNull();
  });
});

// Compile-time closure (AC-15b): a guard function reaching for a
// matter-level advisory deadline field must fail to compile. GuardInput
// names no such field at all — this is the structural exclusion the
// guard-input.ts module note describes.
function guardReachingForAdvisoryDeadline(input: GuardInput): unknown {
  // @ts-expect-error — "feeNotificationDeadline" does not exist on GuardInput
  return input.feeNotificationDeadline;
}
void guardReachingForAdvisoryDeadline;
