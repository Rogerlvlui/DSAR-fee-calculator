// packages/engine/src/messages.ts
//
// The single home for every string template packages/engine itself
// authors — precondition-error text now, flag-reason text in later plans.
// Nothing else in packages/engine may inline a user-visible sentence; this
// module exists so plan 02-07's banned-word test can enumerate
// engine-authored language exhaustively instead of sampling it.
//
// Every message here names both the offending value and the expected value
// (AC-12, AC-42) — never a bare "invalid input" with no specifics.
//
// CLAUDE.md: engine output may never use "compliant", "legal", "lawful",
// "approved" or "safe" — none of the templates below use any of those
// words, and none should be added later without checking that list first.

import type { Minor } from "@dsar/schemas/primitives";

export function packNotActiveMessage(actualStatus: string): string {
  return `Rule pack status is '${actualStatus}', but assess() requires status 'ACTIVE'.`;
}

export function controllerTypeNotInScopeMessage(
  controllerType: string,
  appliesTo: readonly string[]
): string {
  return `Matter controllerType '${controllerType}' is not in the pack's appliesTo [${appliesTo.join(", ")}].`;
}

export function currencyMismatchMessage(
  matterCurrency: string,
  expectedCurrency: string,
  jurisdictionCode: string
): string {
  return `Matter currency '${matterCurrency}' does not match jurisdiction '${jurisdictionCode}''s designated currency '${expectedCurrency}'.`;
}

export function packPastReviewDueMessage(reviewDueOn: string, now: string): string {
  return `Rule pack reviewDueOn '${reviewDueOn}' is before now '${now}' — the pack is past its review date.`;
}

export function claimedAmountMismatchMessage(
  lineId: string,
  storedClaimedAmount: Minor,
  recomputedClaimedAmount: Minor
): string {
  return `Expense line '${lineId}' stored claimedAmount ${storedClaimedAmount} does not equal quantity × unitRate (${recomputedClaimedAmount}).`;
}

export function negativeUnitRateMessage(lineId: string, unitRate: Minor): string {
  return `Expense line '${lineId}' has a negative unitRate (${unitRate}); unitRate must not be negative.`;
}
