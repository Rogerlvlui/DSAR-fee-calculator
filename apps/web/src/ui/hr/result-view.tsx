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
    <div data-testid="result-view" className="card flex flex-col gap-lg">
      <h1 className="screen" data-testid="result-headline">
        Fee assessed: {formatMinor(finalAmount, currency)}
      </h1>
      <div className="notice-document">
        <div className="row">
          <span className="wordmark">Notice of fee — data access request</span>
          <p data-testid="result-signoff-meta" className="caption">
            Matter {matterReference} — reviewed and signed off by {lawyerName}, {qualification}, on {signedAt}.
          </p>
        </div>
        <table data-testid="result-lines" className="notice-table">
          <tbody>
            {lines.map((line) => (
              <tr key={line.id} data-testid="result-line" data-outcome={line.struck ? "struck" : "allowed"}>
                <td data-testid="result-line-description">
                  Line {line.seq} · {line.categoryLabel} — {line.description}
                </td>
                {line.struck ? (
                  <td data-testid="result-line-basis" className="text-ink-3">
                    Not charged. {line.basis}
                  </td>
                ) : (
                  <td data-testid="result-line-amount">{formatMinor(line.amount, currency)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <p data-testid="result-footer" className="caption">
          Reviewed by {lawyerName}, {qualification}.
        </p>
      </div>
    </div>
  );
}
