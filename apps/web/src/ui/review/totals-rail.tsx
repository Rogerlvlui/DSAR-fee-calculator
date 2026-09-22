// apps/web/src/ui/review/totals-rail.tsx
//
// The seven UI-SPEC rows (two of them sub-rows of their parent, rendered
// indented — that indentation is load-bearing, not decorative: PRD §10.3
// warns that a lawyer who reads "resting on unverified rules" as a fourth
// top-level figure will think the totals don't add up) plus the headline
// block. The five engine figures come straight from `assessment.totals` and
// are never recomputed here — the one figure this component DOES compute
// itself, "Allowed by you, not by a rule", has no home on the frozen
// Totals schema because it is a review-time consequence of dispositions the
// engine never sees; it is a plain sum over `lawyerAmount` for
// ALLOWED_BY_LAWYER lines, computed the same way
// apps/web/src/domain/review-tallies.ts (Task 2) computes it, so both stay
// consistent by construction.
//
// While any line is PENDING, the headline renders the hidden-state label
// and the pending-count sentence, and NO final figure is rendered at all —
// not hidden by a style rule, not present in the markup.

import type { Assessment } from "@dsar/schemas/assessment";
import type { CurrencyCode, Minor } from "@dsar/schemas/primitives";
import { formatMinor } from "@dsar/schemas/money";

export const HIDDEN_HEADLINE_TEXT = "— hidden —";
export const NOT_YET_SIGNED_OFF_TEXT = "Not yet signed off";

function pendingCountSentence(pendingCount: number): string {
  return `${pendingCount} line${pendingCount === 1 ? "" : "s"} still need your decision`;
}

function excludedCountLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

function sumLawyerAllowedAmount(assessment: Assessment): Minor {
  return assessment.lines.reduce(
    (total, line) => (line.disposition === "ALLOWED_BY_LAWYER" ? total + (line.lawyerAmount ?? 0) : total),
    0
  ) as Minor;
}

// Pre-sign-off preview only — once totals.finalAmount is written (at
// sign-off), it is the immutable source of truth and this function is
// never consulted. Before that, the headline must reflect a FLAT choice
// (REVIEW-11) the same way computeFinalAmount does (CR-01): falling back
// to draftBaseline regardless of feeChoice would show a figure the lawyer
// never actually chose.
function previewHeadlineAmount(assessment: Assessment): Minor {
  if (assessment.totals.finalAmount != null) return assessment.totals.finalAmount;
  if (assessment.feeChoice === "FLAT" && assessment.totals.flatFeeComparison) {
    return assessment.totals.flatFeeComparison.flatFeeAmount;
  }
  return assessment.totals.draftBaseline;
}

export interface TotalsRailProps {
  assessment: Assessment;
  currency: CurrencyCode;
}

export function TotalsRail({ assessment, currency }: TotalsRailProps) {
  const pendingCount = assessment.lines.filter((line) => line.disposition === "PENDING").length;
  const flaggedCount = assessment.lines.filter((line) => line.verdict === "FLAG").length;
  const allowedByLawyer = sumLawyerAllowedAmount(assessment);

  return (
    <aside data-testid="totals-rail">
      <div data-testid="totals-rows">
        <div data-testid="total-row-claimed">
          <dt>Claimed by HR</dt>
          <dd data-testid="total-claimed">{formatMinor(assessment.totals.claimedTotal, currency)}</dd>
        </div>
        <div data-testid="total-row-supported">
          <dt>Supported by rules</dt>
          <dd data-testid="total-supported">{formatMinor(assessment.totals.draftBaseline, currency)}</dd>
        </div>
        <div data-testid="total-row-resting-unverified" data-indent="true" className="text-ink-3">
          <dt>↳ resting on unverified rules</dt>
          <dd data-testid="total-resting-unverified">
            {formatMinor(assessment.totals.restingOnUnverifiedRules, currency)}
          </dd>
        </div>
        <div data-testid="total-row-allowed-by-lawyer">
          <dt>Allowed by you, not by a rule</dt>
          <dd data-testid="total-allowed-by-lawyer">{formatMinor(allowedByLawyer, currency)}</dd>
        </div>
        <div data-testid="total-row-not-supported">
          <dt>Not supported</dt>
          <dd data-testid="total-not-supported">{formatMinor(assessment.totals.disallowedTotal, currency)}</dd>
        </div>
        <div data-testid="total-row-needs-decision">
          <dt>Needs your decision</dt>
          <dd data-testid="total-needs-decision">{formatMinor(assessment.totals.flaggedTotal, currency)}</dd>
        </div>
        <div data-testid="total-row-excluded" data-indent="true" className="text-ink-3">
          <dt>↳ excluded from every total</dt>
          <dd data-testid="total-excluded-count">{excludedCountLabel(flaggedCount)}</dd>
        </div>
      </div>

      <div data-testid="headline">
        <div>Recommended fee</div>
        {pendingCount > 0 ? (
          <>
            <div data-testid="headline-hidden">{HIDDEN_HEADLINE_TEXT}</div>
            <div data-testid="headline-sub">{pendingCountSentence(pendingCount)}</div>
          </>
        ) : (
          <>
            <div data-testid="headline-value">{formatMinor(previewHeadlineAmount(assessment), currency)}</div>
            <div data-testid="headline-sub">{NOT_YET_SIGNED_OFF_TEXT}</div>
          </>
        )}
      </div>
    </aside>
  );
}
