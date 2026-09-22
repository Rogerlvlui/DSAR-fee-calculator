// apps/web/src/ui/hr/result-view.tsx
//
// PRD §10.4's HR result screen: the fee headline with the reviewing
// lawyer's name, qualification and sign-off date, then the itemisation.
// Struck lines are shown with their pack-authored basis — HR needs to see
// that its optimistic claim was trimmed and why, and the visible restraint
// is itself the evidence that a human exercised judgement. The lawyer's
// own reason is never rendered here, for any line, in any state — and
// ResultViewLine's own shape has no field to carry one, so the privilege
// boundary is structural rather than a habit the component has to remember
// to keep. A zero fee renders with the same headline element and class as
// any other figure — it is an ordinary result, never an error and never an
// empty state.

import type { CurrencyCode, Minor } from "@dsar/schemas/primitives";
import { formatMinor } from "@dsar/schemas/money";

export interface ResultViewLine {
  id: string;
  seq: number;
  categoryLabel: string;
  description: string;
  struck: boolean;
  amount: Minor;
  basis: string;
}

export interface ResultViewProps {
  matterReference: string;
  finalAmount: Minor;
  currency: CurrencyCode;
  lawyerName: string;
  qualification: string;
  signedAt: string;
  lines: readonly ResultViewLine[];
}

export function ResultView({
  matterReference,
  finalAmount,
  currency,
  lawyerName,
  qualification,
  signedAt,
  lines,
}: ResultViewProps) {
  return (
    <div data-testid="result-view">
      <h1 className="screen" data-testid="result-headline">
        Fee assessed: {formatMinor(finalAmount, currency)}
      </h1>
      <p data-testid="result-signoff-meta">
        Matter {matterReference} — reviewed and signed off by {lawyerName}, {qualification}, on {signedAt}.
      </p>
      <ul data-testid="result-lines">
        {lines.map((line) => (
          <li key={line.id} data-testid="result-line" data-outcome={line.struck ? "struck" : "allowed"}>
            <div data-testid="result-line-description">
              Line {line.seq} · {line.categoryLabel} — {line.description}
            </div>
            {line.struck ? (
              <div data-testid="result-line-basis">Not charged. {line.basis}</div>
            ) : (
              <div data-testid="result-line-amount">{formatMinor(line.amount, currency)}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
