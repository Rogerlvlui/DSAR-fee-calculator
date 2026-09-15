// packages/engine/src/errors.ts
//
// PRD §8.1 step 1: every input the engine must refuse is refused with a
// typed, named error — never a partially-populated Assessment (ENGINE-02,
// ENGINE-13, AC-08, AC-12, AC-39, AC-42). AssessPreconditionFailure is the
// single Error subclass every precondition check in preconditions.ts
// throws; its `code` field is a closed discriminated union so a caller can
// switch on it exhaustively, and its `detail` field is structured data
// (never only a prose string) so a caller can render the offending and
// expected values without re-parsing message text.
//
// Task 1 defined the first three precondition codes — PACK_NOT_ACTIVE,
// CONTROLLER_TYPE_NOT_IN_SCOPE, CURRENCY_MISMATCH. Task 3 (this commit)
// adds the remaining three — PACK_PAST_REVIEW_DUE, CLAIMED_AMOUNT_MISMATCH,
// NEGATIVE_UNIT_RATE — now that calendar-math.ts (task 2) exists. The two
// money-named detail fields (storedClaimedAmount/recomputedClaimedAmount,
// unitRate) use the branded Minor type, not a bare number (AC-07a).

import type { ControllerType, CurrencyCode, JurisdictionCode, Minor } from "@dsar/schemas/primitives";
import type { RulePackStatus } from "@dsar/schemas/rule-pack";

export type AssessPreconditionError =
  | { code: "PACK_NOT_ACTIVE"; detail: { actualStatus: RulePackStatus } }
  | {
      code: "CONTROLLER_TYPE_NOT_IN_SCOPE";
      detail: { controllerType: ControllerType; appliesTo: ControllerType[] };
    }
  | {
      code: "CURRENCY_MISMATCH";
      detail: {
        matterCurrency: CurrencyCode;
        expectedCurrency: CurrencyCode;
        jurisdictionCode: JurisdictionCode;
      };
    }
  | { code: "PACK_PAST_REVIEW_DUE"; detail: { reviewDueOn: string; now: string } }
  | {
      code: "CLAIMED_AMOUNT_MISMATCH";
      detail: { lineId: string; storedClaimedAmount: Minor; recomputedClaimedAmount: Minor };
    }
  | { code: "NEGATIVE_UNIT_RATE"; detail: { lineId: string; unitRate: Minor } };

export type AssessPreconditionErrorCode = AssessPreconditionError["code"];

// A real Error subclass (not a bare object) so callers get the usual
// stack-trace/instanceof ergonomics, with `code` and `detail` layered on
// top for structured handling. `message` is always produced by
// messages.ts — this class never inlines its own sentence.
export class AssessPreconditionFailure extends Error {
  readonly code: AssessPreconditionErrorCode;
  readonly detail: AssessPreconditionError["detail"];

  constructor(error: AssessPreconditionError, message: string) {
    super(message);
    this.name = "AssessPreconditionFailure";
    this.code = error.code;
    this.detail = error.detail;
  }
}
