// apps/web/src/ui/intake/categorization-summary.tsx
//
// Section 3 of the HR intake screen (07.1-UI-SPEC.md Screen-by-Screen): "How
// the engine sorted these lines" — a restyle of INTAKE-06's existing
// category hints in the design's own numbered-section visual frame, never a
// new data source or behaviour. Split into two small cards: lines the closed
// 21-code taxonomy actually categorised, and lines that fell into the
// OTHER_UNCLASSIFIED escape hatch ("always referred to Legal"). Both totals
// are computed via computeLineAmountMinor — the SAME per-line amount
// function ClaimFooter's own claimedTotalMinor already reduces over — so
// this section can never silently disagree with the claim total when both
// groups are summed. Imports nothing from apps/web/src/server.

"use client";

import { toMinor, type CurrencyCode } from "@dsar/schemas/primitives";
import { formatMinor } from "@dsar/schemas/money";
import { computeLineAmountMinor, type ExpenseLineDraft } from "./expense-line-repeater.tsx";

export interface CategorizationPartition {
  categorized: ExpenseLineDraft[];
  otherClaims: ExpenseLineDraft[];
}

/** Splits lines by whether the closed taxonomy actually categorised them —
 * OTHER_UNCLASSIFIED is the taxonomy's own escape hatch (never scored
 * automatically, always referred to Legal), so it is the sole partition
 * criterion; every other of the 21 category codes counts as categorized. */
export function partitionLinesByCategorization(lines: readonly ExpenseLineDraft[]): CategorizationPartition {
  const categorized: ExpenseLineDraft[] = [];
  const otherClaims: ExpenseLineDraft[] = [];
  for (const line of lines) {
    if (line.categoryCode === "OTHER_UNCLASSIFIED") {
      otherClaims.push(line);
    } else {
      categorized.push(line);
    }
  }
  return { categorized, otherClaims };
}

function sumAmountMinor(lines: readonly ExpenseLineDraft[], currency: CurrencyCode): number {
  return lines.reduce((total, line) => total + computeLineAmountMinor(line, currency), 0);
}

function lineCountLabel(count: number): string {
  return `${count} line${count === 1 ? "" : "s"}`;
}

export interface CategorizationSummaryProps {
  lines: ExpenseLineDraft[];
  currency: CurrencyCode;
}

export function CategorizationSummary({ lines, currency }: CategorizationSummaryProps) {
  if (lines.length === 0) return null;

  const { categorized, otherClaims } = partitionLinesByCategorization(lines);
  const categorizedTotal = sumAmountMinor(categorized, currency);
  const otherClaimsTotal = sumAmountMinor(otherClaims, currency);

  return (
    <section data-testid="categorization-summary" className="card">
      <h2 className="eyebrow">
        <span className="step-heading">
          <span className="step-number" aria-hidden="true">
            3
          </span>
          How the engine sorted these lines
        </span>
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
        <div data-testid="categorization-summary-categorized" className="summary-row">
          <dt>Categorized — {lineCountLabel(categorized.length)}</dt>
          <dd>{formatMinor(toMinor(categorizedTotal), currency)}</dd>
        </div>
        <div data-testid="categorization-summary-other-claims" className="summary-row">
          <dt>Other claims — {lineCountLabel(otherClaims.length)}</dt>
          <dd>{formatMinor(toMinor(otherClaimsTotal), currency)}</dd>
        </div>
      </div>
    </section>
  );
}
