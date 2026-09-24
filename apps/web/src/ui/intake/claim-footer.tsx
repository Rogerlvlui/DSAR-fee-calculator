// apps/web/src/ui/intake/claim-footer.tsx
//
// The sticky footer at the bottom of the HR intake screen (PRD §10.2): the
// running claimed total through formatMinor, the UI-SPEC's claim-not-the-
// fee sentence verbatim, and the submit control — disabled until every
// condition is met, with the specific unmet condition rendered beside it.
// Imports nothing from apps/web/src/server.

"use client";

import { toMinor, type CurrencyCode } from "@dsar/schemas/primitives";
import { formatMinorWithCode } from "@dsar/schemas/money";

export interface ClaimFooterProps {
  claimedTotalMinor: number;
  currency: CurrencyCode;
  disabledReason: string | null;
  submitting: boolean;
  onSubmit: () => void;
}

// The Annex A claim-footer sentence (docs/dsar-fee-agent-mockup.html:893),
// matching PRD §10.2's required framing — as one plain-text literal, so a
// test can compare the rendered (tag-stripped) text against exactly this
// string rather than reconstructing it from fragments around the <b> tag.
export const CLAIM_NOT_FEE_SENTENCE =
  "Claimed costs — not the assessed fee.";

export function ClaimFooter({ claimedTotalMinor, currency, disabledReason, submitting, onSubmit }: ClaimFooterProps) {
  const disabled = disabledReason !== null || submitting;

  return (
    <div data-testid="claim-footer" className="claimfoot">
      <div className="claimfoot-total">
        <div className="lbl" data-testid="claim-not-fee">{CLAIM_NOT_FEE_SENTENCE}</div>
        <div className="fig num" data-testid="claim-total">
          {formatMinorWithCode(toMinor(claimedTotalMinor), currency)}
        </div>
      </div>
      <div className="claimfoot-action">
        <button type="button" disabled={disabled} className="btn btn-primary" onClick={onSubmit}>
          Submit to Legal
        </button>
        {disabledReason ? (
          <p data-testid="submit-disabled-reason" className="hint stern">
            {disabledReason}
          </p>
        ) : null}
      </div>
    </div>
  );
}
