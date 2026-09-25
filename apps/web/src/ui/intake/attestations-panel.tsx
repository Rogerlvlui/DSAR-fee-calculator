"use client";

export interface AttestationsValue {
  identityVerified: boolean;
  scopeClarified: boolean;
  isKnownDisputeOrLitigation: boolean;
}

export interface AttestationsPanelProps {
  value: AttestationsValue;
  onChange: (value: AttestationsValue) => void;
}

export function AttestationsPanel({ value, onChange }: AttestationsPanelProps) {
  return (
    <section data-testid="attestations-panel" className="card attestations-panel">
      <h2 className="section-title"><span className="step-number" aria-hidden="true">3</span> Attestations</h2>
      <div className="attestation-list">
        <label className="attestation-item">
          <input type="checkbox" name="identityVerified" checked={value.identityVerified}
            onChange={(event) => onChange({ ...value, identityVerified: event.target.checked })} />
          <span><strong>The requestor&apos;s identity has been verified.</strong><small>Verification happens in your existing process; record only that it happened here.</small></span>
        </label>
        <label className="attestation-item">
          <input type="checkbox" name="scopeClarified" checked={value.scopeClarified}
            onChange={(event) => onChange({ ...value, scopeClarified: event.target.checked })} />
          <span><strong>The scope is clear, or clarifications have been resolved.</strong><small>Resolve ambiguity before claiming retrieval costs.</small></span>
        </label>
        <label className="attestation-item">
          <input type="checkbox" name="isKnownDisputeOrLitigation" checked={value.isKnownDisputeOrLitigation}
            onChange={(event) => onChange({ ...value, isKnownDisputeOrLitigation: event.target.checked })} />
          <span><strong>The requestor is in a known dispute or litigation with the company.</strong><small>Legal will consider whether charging a fee is appropriate.</small></span>
        </label>
      </div>
    </section>
  );
}
