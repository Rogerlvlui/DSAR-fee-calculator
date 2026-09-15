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

import type { Condition } from "@dsar/schemas/condition";
import type { Minor, StaffGrade } from "@dsar/schemas/primitives";

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

// Plan 02-04 Task 1 — applyCap's EngineComputationFailure. PER_MATTER is the
// aggregate-cap variant (PRD §8.1 step 5); it cannot be evaluated correctly
// by a function that only sees one line, so applyCap refuses it outright
// rather than misapplying it as a per-line figure.
export function perMatterCapOnLineMessage(): string {
  return "Cap type 'PER_MATTER' cannot be applied to a single line by applyCap(); it is the aggregate cap evaluated once across every allowed line, not a per-CategoryRule cap.";
}

export function allowWithCapMissingCapMessage(ruleId: string, categoryCode: string): string {
  return `Rule '${ruleId}' for category '${categoryCode}' has treatment 'ALLOW_WITH_CAP' but no cap is authored.`;
}

// Plan 02-04 Task 2 — flag-reason message templates. Every FlagReason the
// engine authors gets its text from here, never an inline sentence
// (plan 02-07 enumerates this module exhaustively for the banned-word
// test). Each stays inside FlagReasonSchema's 200-character cap.

// §8.1 step 2 — NO_EXPRESS_AUTHORITY posture: every line is FLAG with this
// single reason, and draftBaseline is 0 (AC-13).
export function noFeeAuthorityMessage(): string {
  return "The rule pack records no express authority to charge a fee for this controller type; this line is referred to Legal rather than assessed.";
}

// §6.3 — OTHER_UNCLASSIFIED is the only escape hatch in the closed
// taxonomy and is always referred to Legal (AC-19), independent of
// whatever treatment the pack's own rule for that category carries.
export function uncategorisedMessage(): string {
  return "This line's category is 'Something else' and is always referred to Legal for classification, regardless of the pack's rule for this category.";
}

// A CategoryRule authored with treatment FLAG directly (not via the
// OTHER_UNCLASSIFIED override above) — PRD §7.5/§7.6's own examples use
// this only for OTHER_UNCLASSIFIED, but the schema does not close off a
// pack author using it elsewhere. FlagReasonCodeSchema has no code
// dedicated to "the pack's own rule always refers this category to
// Legal", so this reuses UNCATEGORISED — the closest existing code for
// "the engine did not compute a figure for this line and refers it to
// Legal without a machine-evaluable reason" — with wording that does not
// claim the category itself is unknown, unlike uncategorisedMessage()
// above. Untested by this plan's golden fixture (no fixture line
// references a non-OTHER_UNCLASSIFIED category authored with plain FLAG);
// flagged here for a future FlagReasonCode addition if a real pack ever
// needs to distinguish the two.
export function ruleAuthoredFlagMessage(ruleId: string): string {
  return `Rule '${ruleId}' always refers this category to Legal; the pack authors no machine-evaluable basis for an amount.`;
}

export function conditionsNotMetMessage(failed: readonly Condition[]): string {
  const MAX_LISTED = 3;
  const FLAG_REASON_MESSAGE_MAX = 200; // mirrors FlagReasonSchema.message max

  function describe(condition: Condition): string {
    // Narrowing on `"value" in condition` rather than `condition.op ===
    // "isNull" | "isNotNull"` — the latter does not narrow this
    // three-armed zod union reliably under this codebase's tsconfig; `in`
    // does.
    if (!("value" in condition)) {
      return `${condition.field} ${condition.op}`;
    }
    return `${condition.field} ${condition.op} ${JSON.stringify(condition.value)}`;
  }

  const listed = failed.slice(0, MAX_LISTED).map(describe);
  const omittedCount = failed.length - listed.length;
  const suffix = omittedCount > 0 ? ` (+${omittedCount} more)` : "";
  const message = `Conditions not met: ${listed.join("; ")}${suffix}.`;

  return message.length > FLAG_REASON_MESSAGE_MAX
    ? `${message.slice(0, FLAG_REASON_MESSAGE_MAX - 1)}…`
    : message;
}

// Plan 02-05 Task 1 — the four §8.1 step-4 cross-line checks' flag-reason
// message templates. See cross-line-checks.ts for the checks themselves and
// for D-13's recorded reason the fifth ("implausible magnitude") check is
// deliberately absent. Each stays inside FlagReasonSchema's 200-character
// cap and describes what the engine compared, never pronouncing on the
// result (CLAUDE.md's banned-word list).

export function possibleDuplicateMessage(): string {
  return "Another line in the same category has an identical description once trimmed, lower-cased, and its internal whitespace collapsed to single spaces — both lines are flagged as possible duplicates.";
}

export function materialityMessage(): string {
  return "This line's claimed amount is 40% or more of the total claimed amount and is referred to Legal for materiality review.";
}

export function rateAboveExpectedMessage(grade: StaffGrade, unitRate: Minor, ceiling: Minor): string {
  return `This line's unitRate ${unitRate} exceeds the rule pack's rateSanityCeiling ${ceiling} authored for staff grade '${grade}'.`;
}

export function vendorEvidenceMissingMessage(categoryCode: string): string {
  return `Category '${categoryCode}' is a third-party vendor charge not marked isThirdPartyInvoiced, and no applied rule condition already tests that field.`;
}

// Plan 02-05 Task 2 — the aggregate-cap step's matter-level flag and its
// single refusal message. See aggregate-cap.ts.

export function aggregateCapAppliedMessage(): string {
  return "The rule pack's aggregate cap reduced this matter's total allowed amount; every allowed line was reduced pro-rata, rounded down, with the remainder left unallocated.";
}

export function aggregateCapInvalidTypeMessage(capType: string): string {
  return `Rule pack constraints.aggregateCap has type '${capType}', which has no matter-wide meaning; only 'PER_MATTER' or 'PERCENT_OF_CLAIM' may be used as an aggregate cap.`;
}
