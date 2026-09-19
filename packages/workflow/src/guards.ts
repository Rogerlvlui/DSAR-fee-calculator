// packages/workflow/src/guards.ts
//
// Shared guard predicates extracted from transitions.ts so two rows that
// state the same PRD §5 precondition evaluate the same code rather than two
// drifting copies (04-02-PLAN.md Task 1). Every predicate here is pure — it
// reads no clock, performs no I/O, and takes only values already present on
// the frozen GuardInput — and every refusal names its own unmet condition
// specifically, never a generic "refused" message.

import { JURISDICTION_CURRENCY } from "@dsar/schemas/primitives";
import type { CurrencyCode, JurisdictionCode, UserRef } from "@dsar/schemas/primitives";
import type { GuardInput } from "@dsar/schemas/guard-input";

// The shape every guard predicate — shared or row-specific — returns.
// Defined here (not in transitions.ts) so this module has no import-cycle
// back to the module that imports these predicates.
export type GuardResult = { allowed: true } | { allowed: false; reason: string };

type Pack = GuardInput["pack"];

// A pack is present for the jurisdiction at all. Deliberately narrower than
// checkPackUsable below: the recompute and sign-off rows only require a pack
// to be pinned/available, not that it also be ACTIVE and non-stale (04-02-
// PLAN.md's action note for the recompute row).
export function checkPackAvailable(pack: Pack, jurisdictionCode: JurisdictionCode): GuardResult {
  if (!pack) {
    return {
      allowed: false,
      reason: `No rule pack is available for jurisdiction '${jurisdictionCode}'`,
    };
  }
  return { allowed: true };
}

// A pack exists, is ACTIVE, and is not past its review date. Shared by the
// submit and resubmit rows, which both name this exact precondition.
export function checkPackUsable(pack: Pack, jurisdictionCode: JurisdictionCode): GuardResult {
  const availability = checkPackAvailable(pack, jurisdictionCode);
  if (!availability.allowed) return availability;
  // Narrowed non-null by checkPackAvailable's own check above.
  const usablePack = pack as NonNullable<Pack>;
  if (usablePack.status === "STALE") {
    return {
      allowed: false,
      reason: `The rule pack for jurisdiction '${jurisdictionCode}' is past its review date (${usablePack.reviewDueOn}) and is STALE`,
    };
  }
  if (usablePack.status !== "ACTIVE") {
    return {
      allowed: false,
      reason: `The rule pack for jurisdiction '${jurisdictionCode}' is not ACTIVE (currently ${usablePack.status})`,
    };
  }
  return { allowed: true };
}

// The matter's currency equals its jurisdiction's one designated currency
// (§6.0, AC-42). The refusal names both currencies.
export function checkCurrencyMatches(
  jurisdictionCode: JurisdictionCode,
  currency: CurrencyCode
): GuardResult {
  const expectedCurrency = JURISDICTION_CURRENCY[jurisdictionCode];
  if (currency !== expectedCurrency) {
    return {
      allowed: false,
      reason: `Matter currency '${currency}' does not match jurisdiction '${jurisdictionCode}''s designated currency '${expectedCurrency}'`,
    };
  }
  return { allowed: true };
}

// At least one expense line exists on the matter.
export function checkAtLeastOneLine(expenseLineCount: number): GuardResult {
  if (expenseLineCount < 1) {
    return { allowed: false, reason: "At least one expense line is required" };
  }
  return { allowed: true };
}

// A named lawyer identity is recorded — every action this predicate guards
// is a legal act, and an unattributed one is indefensible.
export function checkLawyerIdentity(lawyerIdentity: UserRef | null): GuardResult {
  if (!lawyerIdentity) {
    return { allowed: false, reason: "A lawyer identity must be recorded for this action" };
  }
  return { allowed: true };
}

// Every matter-level flag requiring acknowledgement is present in the
// acknowledged list. Names the specific unacknowledged flag id(s).
export function checkFlagsAcknowledged(
  matterLevelFlagsRequiringAck: readonly string[],
  acknowledgedFlags: readonly string[]
): GuardResult {
  const unacknowledged = matterLevelFlagsRequiringAck.filter(
    (flagId) => !acknowledgedFlags.includes(flagId)
  );
  if (unacknowledged.length > 0) {
    return {
      allowed: false,
      reason: `The following matter-level flag(s) require acknowledgement before sign-off: ${unacknowledged.join(", ")}`,
    };
  }
  return { allowed: true };
}

// No expense line is still in PENDING disposition.
export function checkNoLinesPending(pendingLineCount: number): GuardResult {
  if (pendingLineCount > 0) {
    return {
      allowed: false,
      reason: `${pendingLineCount} line(s) are still pending disposition`,
    };
  }
  return { allowed: true };
}
