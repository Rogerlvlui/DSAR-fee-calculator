// apps/web/src/ui/review/assessment-view.tsx
//
// The minimal but real review body, props in and markup out. For each line:
// a verdict badge whose text names the verdict in words, HR's own
// description quoted next to the category label, the claimed arithmetic,
// the applied rule id, the pack-authored basis and the citation — the last
// three always visible, never behind a disclosure control. A totals region
// renders the six figures through formatMinor only. While any line is
// PENDING, the headline renders the hidden state and no final figure is
// rendered at all. Imports nothing from the app's server-side module tree.
// Plan 03 expands this into the full card layout, ordering and controls —
// this is deliberately not that yet.

import type { Assessment, Verdict } from "@dsar/schemas/assessment";
import type { ExpenseLine } from "@dsar/schemas/expense-line";
import type { CurrencyCode } from "@dsar/schemas/primitives";
import { formatMinor } from "@dsar/schemas/money";
import { EXPENSE_CATEGORY_LABELS } from "@dsar/schemas/taxonomy";

export interface AssessmentViewProps {
  assessment: Assessment;
  expenseLines: readonly ExpenseLine[];
  currency: CurrencyCode;
}

// UI-SPEC Copywriting Contract, verbatim.
const VERDICT_LABELS: Record<Verdict, string> = {
  FLAG: "Needs your decision",
  ALLOW: "Supported by rule",
  ALLOW_CAPPED: "Supported — reduced to cap",
  DISALLOW: "Not supported",
};

const HIDDEN_HEADLINE_TEXT = "— hidden —";

function pendingCountSentence(pendingCount: number): string {
  return `${pendingCount} line${pendingCount === 1 ? "" : "s"} still need your decision`;
}

function formatCitation(citation: Assessment["lines"][number]["citation"]): string {
  const parts = [`${citation.instrument} ${citation.provision}`.trim()];
  if (citation.guidance) parts.push(citation.guidance);
  if (citation.note) parts.push(citation.note);
  return parts.join(" — ");
}

export function AssessmentView({ assessment, expenseLines, currency }: AssessmentViewProps) {
  const expenseLineById = new Map(expenseLines.map((line) => [line.id, line]));
  const pendingCount = assessment.lines.filter((line) => line.disposition === "PENDING").length;

  return (
    <div data-testid="assessment-view">
      <div data-testid="assessment-lines">
        {assessment.lines.map((line) => {
          const expenseLine = expenseLineById.get(line.expenseLineId);
          const categoryLabel = expenseLine ? EXPENSE_CATEGORY_LABELS[expenseLine.categoryCode] : null;

          return (
            <article key={line.id} data-testid="assessment-line" data-verdict={line.verdict}>
              <div>
                <span data-testid="verdict-badge">{VERDICT_LABELS[line.verdict]}</span>
                {categoryLabel ? <span data-testid="category-label"> {categoryLabel}</span> : null}
              </div>

              {expenseLine ? (
                <div data-testid="hr-description">
                  <span>HR's description</span>
                  <q>{expenseLine.description}</q>
                </div>
              ) : null}

              {expenseLine ? (
                <div data-testid="claimed-arithmetic">
                  Claimed {expenseLine.quantity} {expenseLine.unit} ×{" "}
                  {formatMinor(expenseLine.unitRate, currency)} ={" "}
                  {formatMinor(expenseLine.claimedAmount, currency)} → engine{" "}
                  {formatMinor(line.engineAmount, currency)}
                </div>
              ) : null}

              <div data-testid="applied-rule-id">{line.appliedRuleId}</div>
              <div data-testid="basis">{line.basis}</div>
              <div data-testid="citation">{formatCitation(line.citation)}</div>
            </article>
          );
        })}
      </div>

      <div data-testid="totals">
        <div>
          <dt>Claimed by HR</dt>
          <dd>{formatMinor(assessment.totals.claimedTotal, currency)}</dd>
        </div>
        <div>
          <dt>Supported by rules</dt>
          <dd>{formatMinor(assessment.totals.draftBaseline, currency)}</dd>
        </div>
        <div>
          <dt>↳ resting on unverified rules</dt>
          <dd>{formatMinor(assessment.totals.restingOnUnverifiedRules, currency)}</dd>
        </div>
        <div>
          <dt>Not supported</dt>
          <dd>{formatMinor(assessment.totals.disallowedTotal, currency)}</dd>
        </div>
        <div>
          <dt>Needs your decision</dt>
          <dd>{formatMinor(assessment.totals.flaggedTotal, currency)}</dd>
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
            <div data-testid="headline-value">
              {formatMinor(assessment.totals.finalAmount ?? assessment.totals.draftBaseline, currency)}
            </div>
            <div data-testid="headline-sub">Not yet signed off</div>
          </>
        )}
      </div>
    </div>
  );
}
