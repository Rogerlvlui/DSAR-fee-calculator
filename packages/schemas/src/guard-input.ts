// packages/schemas/src/guard-input.ts
//
// SCHEMA-06 / AC-15(b): GuardInput is a literal, hand-authored object type
// — never derived via Omit<Matter, ...> or Pick<Matter, ...> — so a guard
// function reading a matter-level advisory deadline field is a compile
// error, and that exclusion stays structural even if Matter is later
// widened (a later Omit/Pick would still describe a structural subtype of
// Matter, and a spread could silently re-admit an excluded field). See
// 01-RESEARCH.md, Architecture Patterns Pattern 3, and CONTEXT.md's
// Claude's Discretion note (Assumptions Log A4).
//
// `reviewDueOn` here is the PACK's lifecycle date (RulePack.reviewDueOn),
// not a matter deadline — AC-15(b) explicitly calls this out as belonging
// inside GuardInput. The matter's advisory fee-notification deadline
// figures are a display-only concern (AC-15(a)): rendered with the word
// "Advisory" in their own container (DISC-05, Phase 5) and are structurally
// absent from this type — no field here names them at all.
//
// This is a type declaration only, not a zod schema. State-machine guard
// functions (STATE-02..05, Phase 4) are pure functions over this type;
// nothing parses a GuardInput value at runtime.

import type { ControllerType, CurrencyCode, JurisdictionCode, UserRef } from "./primitives.ts";
import type { MatterStatus } from "./matter-status.ts";
import type { RulePack } from "./rule-pack.ts";

export type GuardInput = {
  matterStatus: MatterStatus;
  expenseLineCount: number;
  jurisdictionCode: JurisdictionCode;
  currency: CurrencyCode;
  controllerType: ControllerType;
  pack: {
    status: RulePack["status"];
    reviewDueOn: RulePack["reviewDueOn"];
    appliesTo: RulePack["appliesTo"];
  } | null;
  attestationsAddressed: boolean;
  pendingLineCount: number;
  matterLevelFlagsRequiringAck: string[];
  acknowledgedFlags: string[];
  lawyerIdentity: UserRef | null;
};
