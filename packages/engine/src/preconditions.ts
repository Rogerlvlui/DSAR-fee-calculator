// packages/engine/src/preconditions.ts
//
// PRD §8.1 step 1 — every input the engine must refuse before computing a
// figure at all (ENGINE-02, ENGINE-13, AC-08, AC-12, AC-39, AC-42). Each
// check throws AssessPreconditionFailure on the FIRST failure; no
// Assessment is ever partially constructed past a failing precondition.
//
// Task 1 implements three checks here: pack ACTIVE status, controllerType
// in appliesTo, and currency match. Task 3 (same plan) extends this
// function with three more — reviewDueOn staleness (needs calendar-math.ts,
// built in task 2), claimed-amount integrity, and negative unitRate
// rejection.

import type { Matter } from "@dsar/schemas/matter";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { RulePack } from "@dsar/schemas/rule-pack";
import { JURISDICTION_CURRENCY } from "@dsar/schemas/primitives";
import { AssessPreconditionFailure } from "./errors.ts";
import {
  controllerTypeNotInScopeMessage,
  currencyMismatchMessage,
  packNotActiveMessage,
} from "./messages.ts";

export interface CheckPreconditionsInput {
  matter: Matter;
  lines: readonly ExpenseLine[];
  pack: RulePack;
  now: string;
}

export function checkPreconditions(input: CheckPreconditionsInput): void {
  const { matter, pack } = input;

  if (pack.status !== "ACTIVE") {
    throw new AssessPreconditionFailure(
      { code: "PACK_NOT_ACTIVE", detail: { actualStatus: pack.status } },
      packNotActiveMessage(pack.status)
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
}
