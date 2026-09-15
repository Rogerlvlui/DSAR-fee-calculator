// packages/engine/src/preconditions.ts
//
// PRD §8.1 step 1 — every input the engine must refuse before computing a
// figure at all (ENGINE-02, ENGINE-13, AC-08, AC-12, AC-39, AC-42). Each
// check throws AssessPreconditionFailure on the FIRST failure; no
// Assessment is ever partially constructed past a failing precondition.
//
// Task 1 implemented three checks: pack ACTIVE status, controllerType in
// appliesTo, and currency match. Task 3 (this commit) adds three more —
// reviewDueOn staleness (using calendar-math.ts from task 2), claimed-amount
// integrity, and negative unitRate rejection.
//
// ENGINE-13 / AC-08 — why the claimed-amount check exists a second time:
// ExpenseLineSchema already carries the same `claimedAmount === quantity *
// unitRate` invariant as a superRefine. That schema check only fires where
// something calls `.parse()` — and assess() is explicitly documented as not
// parsing its inputs in the hot path (see assess.ts), so a row read straight
// out of Postgres and mapped to a domain object reaches the engine unparsed.
// This precondition is an independent second check at that trust boundary
// (ASVS V5, threat T-2-05) — exactly the posture a defensibility-critical
// calculation needs. It never "fixes" a mismatching claimedAmount by
// recomputing it into the assessment; PRD §8.1 forbids that silent
// adjustment, so a mismatch is refused outright, not corrected.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { RulePack } from "@dsar/schemas/rule-pack";
import { JURISDICTION_CURRENCY, type Minor } from "@dsar/schemas/primitives";
import { daysUntil } from "./calendar-math.ts";
import { AssessPreconditionFailure } from "./errors.ts";
import {
  claimedAmountMismatchMessage,
  controllerTypeNotInScopeMessage,
  currencyMismatchMessage,
  negativeUnitRateMessage,
  packNotActiveMessage,
  packPastReviewDueMessage,
} from "./messages.ts";

export interface CheckPreconditionsInput {
  matter: Matter;
  lines: readonly ExpenseLine[];
  pack: RulePack;
  now: string;
}

export function checkPreconditions(input: CheckPreconditionsInput): void {
  const { matter, lines, pack, now } = input;

  if (pack.status !== "ACTIVE") {
    throw new AssessPreconditionFailure(
      { code: "PACK_NOT_ACTIVE", detail: { actualStatus: pack.status } },
      packNotActiveMessage(pack.status)
    );
  }

  // AC-39: "past", not "on" — a pack due exactly today still passes. The
  // 30-day advance warning is a matter flag (plan 02-06), not a precondition.
  if (daysUntil(now, pack.reviewDueOn) < 0) {
    throw new AssessPreconditionFailure(
      { code: "PACK_PAST_REVIEW_DUE", detail: { reviewDueOn: pack.reviewDueOn, now } },
      packPastReviewDueMessage(pack.reviewDueOn, now)
    );
  }

  if (!pack.appliesTo.includes(matter.controllerType)) {
    throw new AssessPreconditionFailure(
      {
        code: "CONTROLLER_TYPE_NOT_IN_SCOPE",
        detail: { controllerType: matter.controllerType, appliesTo: [...pack.appliesTo] },
      },
      controllerTypeNotInScopeMessage(matter.controllerType, pack.appliesTo)
    );
  }

  const expectedCurrency = JURISDICTION_CURRENCY[matter.jurisdictionCode];
  if (matter.currency !== expectedCurrency) {
    throw new AssessPreconditionFailure(
      {
        code: "CURRENCY_MISMATCH",
        detail: {
          matterCurrency: matter.currency,
          expectedCurrency,
          jurisdictionCode: matter.jurisdictionCode,
        },
      },
      currencyMismatchMessage(matter.currency, expectedCurrency, matter.jurisdictionCode)
    );
  }

  for (const line of lines) {
    const recomputedClaimedAmount = (line.quantity * line.unitRate) as Minor;
    if (line.claimedAmount !== recomputedClaimedAmount) {
      throw new AssessPreconditionFailure(
        {
          code: "CLAIMED_AMOUNT_MISMATCH",
          detail: {
            lineId: line.id,
            storedClaimedAmount: line.claimedAmount,
            recomputedClaimedAmount,
          },
        },
        claimedAmountMismatchMessage(line.id, line.claimedAmount, recomputedClaimedAmount)
      );
    }

    if (line.unitRate < 0) {
      throw new AssessPreconditionFailure(
        { code: "NEGATIVE_UNIT_RATE", detail: { lineId: line.id, unitRate: line.unitRate } },
        negativeUnitRateMessage(line.id, line.unitRate)
      );
    }
  }
}
