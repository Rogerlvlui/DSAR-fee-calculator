// apps/web/src/ui/review/signoff-panel.tsx
//
// The confirmation panel PRD §10.3 opens when the pending count reaches
// zero: the four decision counts and the final figure (from
// apps/web/src/domain/review-tallies.ts), one acknowledgement row per
// matter flag requiring acknowledgement, the §9.5 attestation text in full
// with the lawyer's name and qualification, and the primary call to action.
// The button stays disabled until every acknowledgement is checked, with
// the specific blocking reason rendered beside it. On failure it renders
// the sign-off failure string inline and does not navigate away — a
// navigation after a failed sign-off reads as success.
//
// Split the same way disposition-controls.tsx/bulk-accept-bar.tsx are: a
// pure, exported *View component (what this module's own tests render) and
// a stateful wrapper owning useState/useRouter/fetch, because useRouter()
// throws under a bare renderToStaticMarkup() outside a real Next request.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CurrencyCode, Minor, MatterFlag } from "@dsar/schemas/primitives";
import { formatMinorWithCode } from "@dsar/schemas/money";
import type { ReviewTallies } from "../../domain/review-tallies.ts";
import { REVIEWED_ON_NOT_RECORDED_NOTE } from "../../domain/attestation.ts";

export const SIGN_OFF_CTA = "Sign off and release to HR";
export const SIGN_OFF_BLOCKING_REASON = "Every flag above must be acknowledged before you can sign off.";
export const QUALIFICATION_REQUIRED_REASON = "Enter your qualification before signing off.";
const SIGN_OFF_FAILURE_PREFIX = "Sign-off failed — ";
const SIGN_OFF_FAILURE_SUFFIX = ". No changes were made; the assessment is still in Legal Review.";

function signOffFailureMessage(detail: string): string {
  return `${SIGN_OFF_FAILURE_PREFIX}${detail}${SIGN_OFF_FAILURE_SUFFIX}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface SignOffPanelViewProps {
  tallies: ReviewTallies;
  finalAmount: Minor;
  currency: CurrencyCode;
  flagsRequiringAck: readonly MatterFlag[];
  acknowledged: ReadonlySet<string>;
  onToggleAck: (flagId: string) => void;
  attestationText: string;
  reviewedOnNotRecorded: boolean;
  lawyerName: string;
  qualification: string;
  onQualificationChange: (value: string) => void;
  error: string | null;
  pending: boolean;
  onSubmit: () => void;
}

/** Pure, props-driven — this is what signoff-panel.test.tsx renders
 * directly. */
export function SignOffPanelView({
  tallies,
  finalAmount,
  currency,
  flagsRequiringAck,
  acknowledged,
  onToggleAck,
  attestationText,
  reviewedOnNotRecorded,
  lawyerName,
  qualification,
  onQualificationChange,
  error,
  pending,
  onSubmit,
}: SignOffPanelViewProps) {
  const unacknowledged = flagsRequiringAck.filter((flag) => !acknowledged.has(flag.id));
  const disabled = pending || unacknowledged.length > 0 || qualification.trim().length === 0;

  return (
    <div data-testid="signoff-panel" className="card">
      <div className="signoff-band">
        <div className="eyebrow">Sign off</div>
      </div>
      <dl data-testid="signoff-tally">
        <div className="summary-row">
          <dt>Accepted as assessed</dt>
          <dd data-testid="signoff-accepted">{tallies.accepted}</dd>
        </div>
        <div className="summary-row">
          <dt>Reduced by you</dt>
          <dd data-testid="signoff-reduced">{tallies.reduced}</dd>
        </div>
        <div className="summary-row">
          <dt>Struck by you</dt>
          <dd data-testid="signoff-struck">{tallies.struck}</dd>
        </div>
        <div className="summary-row">
          <dt>Allowed by you</dt>
          <dd data-testid="signoff-lawyer-allowed">{tallies.lawyerAllowed}</dd>
        </div>
        <div className="summary-total">
          <dt>Final fee</dt>
          <dd data-testid="signoff-final-amount">{formatMinorWithCode(finalAmount, currency)}</dd>
        </div>
      </dl>

      {flagsRequiringAck.map((flag) => (
        <div key={flag.id} data-testid="signoff-ack-row" className="why">
          <label className="flex items-center gap-xs">
            <input
              type="checkbox"
              data-testid="signoff-ack-checkbox"
              data-flag-id={flag.id}
              checked={acknowledged.has(flag.id)}
              disabled={pending}
              onChange={() => onToggleAck(flag.id)}
            />
            <span>
              <b>Acknowledgement required.</b> {flag.message}
            </span>
          </label>
        </div>
      ))}

      <div data-testid="signoff-attestation" className="why">
        <p className="font-serif">{attestationText}</p>
        {reviewedOnNotRecorded ? (
          <p data-testid="signoff-reviewed-on-note" className="hint">
            {REVIEWED_ON_NOT_RECORDED_NOTE}
          </p>
        ) : null}
      </div>

      <div data-testid="signoff-signatory" className="flex flex-col gap-xs">
        <label className="flex flex-col gap-2xs">
          <span className="hint">Lawyer</span>
          <input type="text" value={lawyerName} readOnly />
        </label>
        <label className="flex flex-col gap-2xs">
          <span className="hint">Qualification</span>
          <input
            type="text"
            data-testid="signoff-qualification"
            value={qualification}
            disabled={pending}
            onChange={(event) => onQualificationChange(event.target.value)}
          />
        </label>
      </div>

      <button type="button" data-testid="signoff-submit" disabled={disabled} className="btn btn-primary" onClick={onSubmit}>
        {SIGN_OFF_CTA}
      </button>
      {unacknowledged.length > 0 ? (
        <span data-testid="signoff-blocking-reason" className="hint stern">
          {SIGN_OFF_BLOCKING_REASON}
        </span>
      ) : qualification.trim().length === 0 ? (
        <span data-testid="signoff-blocking-reason" className="hint stern">
          {QUALIFICATION_REQUIRED_REASON}
        </span>
      ) : null}

      {error ? (
        <p role="alert" data-testid="signoff-error" className="hint stern">
          {signOffFailureMessage(error)}
        </p>
      ) : null}
    </div>
  );
}

export interface SignOffPanelProps {
  assessmentId: string;
  tallies: ReviewTallies;
  finalAmount: Minor;
  currency: CurrencyCode;
  flagsRequiringAck: readonly MatterFlag[];
  attestationText: string;
  reviewedOnNotRecorded: boolean;
  lawyerName: string;
}

export function SignOffPanel({
  assessmentId,
  tallies,
  finalAmount,
  currency,
  flagsRequiringAck,
  attestationText,
  reviewedOnNotRecorded,
  lawyerName,
}: SignOffPanelProps) {
  const router = useRouter();
  const [acknowledged, setAcknowledged] = useState<ReadonlySet<string>>(new Set());
  const [qualification, setQualification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleAck(flagId: string) {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(flagId)) {
        next.delete(flagId);
      } else {
        next.add(flagId);
      }
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/signoff`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qualification,
          acknowledgedFlags: [...acknowledged],
          attestation: true,
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <SignOffPanelView
      tallies={tallies}
      finalAmount={finalAmount}
      currency={currency}
      flagsRequiringAck={flagsRequiringAck}
      acknowledged={acknowledged}
      onToggleAck={toggleAck}
      attestationText={attestationText}
      reviewedOnNotRecorded={reviewedOnNotRecorded}
      lawyerName={lawyerName}
      qualification={qualification}
      onQualificationChange={setQualification}
      error={error}
      pending={submitting}
      onSubmit={handleSubmit}
    />
  );
}
