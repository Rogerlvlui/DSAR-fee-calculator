// apps/web/src/ui/intake/attestations-panel.tsx
//
// Section 2 of the HR intake screen (PRD §10.2): three attestation
// checkboxes, each with a one-line explanation. The identity-verified note
// is capped at the frozen FREE_TEXT_LIMITS.identityVerifiedNote and carries
// the do-not-enter-personal-data warning directly under the field,
// verbatim (03.1-UI-SPEC.md Copywriting Contract). Imports nothing from
// apps/web/src/server.

"use client";

export interface AttestationsValue {
  identityVerified: boolean;
  identityVerifiedNote: string;
  scopeClarified: boolean;
  isKnownDisputeOrLitigation: boolean;
}

export interface AttestationsPanelProps {
  value: AttestationsValue;
  onChange: (value: AttestationsValue) => void;
  /** FREE_TEXT_LIMITS.identityVerifiedNote (@dsar/schemas/constants) — the
   * caller passes this in rather than the component importing the
   * constant itself, keeping the frozen limit visibly load-bearing at the
   * call site. */
  noteMaxLength: number;
}

// 03.1-UI-SPEC.md Copywriting Contract, verbatim.
export const IDENTITY_NOTE_WARNING =
  "Do not enter the requestor's name, NRIC/FIN or any personal data here. Reference your verification record instead.";

export function AttestationsPanel({ value, onChange, noteMaxLength }: AttestationsPanelProps) {
  return (
    <section data-testid="attestations-panel">
      <h2>Attestations</h2>

      <div className="row">
        <input
          type="checkbox"
          name="identityVerified"
          checked={value.identityVerified}
          onChange={(event) => onChange({ ...value, identityVerified: event.target.checked })}
        />
        <div>
          <label>The requestor&apos;s identity has been verified.</label>
          <p className="why">
            Verification happens in your existing process. This tool only records that it happened.
          </p>
          <textarea
            name="identityVerifiedNote"
            value={value.identityVerifiedNote}
            maxLength={noteMaxLength}
            onChange={(event) => onChange({ ...value, identityVerifiedNote: event.target.value })}
          />
          <p data-testid="identity-note-warning" className="hint stern">
            {IDENTITY_NOTE_WARNING}
          </p>
        </div>
      </div>

      <div className="row">
        <input
          type="checkbox"
          name="scopeClarified"
          checked={value.scopeClarified}
          onChange={(event) => onChange({ ...value, scopeClarified: event.target.checked })}
        />
        <div>
          <label>The scope of the request is clear, or clarifications have been resolved.</label>
          <p className="why">
            If items are still ambiguous, resolve them with the requestor before claiming the cost
            of retrieving them.
          </p>
        </div>
      </div>

      <div className="row">
        <input
          type="checkbox"
          name="isKnownDisputeOrLitigation"
          checked={value.isKnownDisputeOrLitigation}
          onChange={(event) => onChange({ ...value, isKnownDisputeOrLitigation: event.target.checked })}
        />
        <div>
          <label>This requestor is, to my knowledge, in a dispute or litigation with the company.</label>
          <p className="why">
            Checking this doesn&apos;t stop anything. It tells the reviewing lawyer that a fee which
            is defensible in principle may still be unwise here.
          </p>
        </div>
      </div>
    </section>
  );
}
