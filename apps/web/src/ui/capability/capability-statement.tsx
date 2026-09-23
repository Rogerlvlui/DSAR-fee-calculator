// apps/web/src/ui/capability/capability-statement.tsx
//
// The first-use notice (Annex A: docs/dsar-fee-agent-mockup.html:1238-1262).
// The five original bullets, the kicker, heading, lede, type-to-confirm
// label and the closing why-layered paragraph are transcribed verbatim from
// Annex A. The sixth bullet is 03.1-UI-SPEC.md's new locked string, in the
// same <li><span/><div/></li> structure as the other five — nothing here is
// re-worded.
//
// Acknowledgement is recorded in browser storage only (an explicit key), so
// the statement is shown once per browser and again whenever the key is
// cleared — never server-side, since there is no user account in this demo
// and pretending there is would be the demo overstating itself. This
// component imports nothing from apps/web/src/server.

"use client";

import { useEffect, useState, type ReactNode } from "react";

export const CAPABILITY_ACK_STORAGE_KEY = "dsar_demo_capability_ack";

// Bump this to force every browser to see the statement again (a content
// change to the bullets above, or a new disclosure obligation). The stored
// value is this constant's string form, not a bare "true" — Phase 3.1's own
// original sentinel. A stored value is "acknowledged" only when it parses to
// a finite number >= this constant; `Number.parseInt("true", 10)` is `NaN`,
// so the legacy sentinel already falls through to "not acknowledged" with no
// special-casing required.
export const CAPABILITY_STATEMENT_VERSION = 1;

const CONFIRMATION_PHRASE = "i understand";

/**
 * Trims and lower-cases both sides before comparing, so the phrase is
 * accepted case- and whitespace-insensitively (03.1-UI-SPEC.md). Exported so
 * the enabling rule is tested directly, not only through markup.
 */
export function isConfirmationPhraseConfirmed(input: string): boolean {
  return input.trim().toLowerCase() === CONFIRMATION_PHRASE;
}

export interface CapabilityStatementProps {
  /** Rendered once the statement has been acknowledged. */
  children: ReactNode;
}

export function CapabilityStatement({ children }: CapabilityStatementProps) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem(CAPABILITY_ACK_STORAGE_KEY);
    const storedVersion = stored === null ? Number.NaN : Number.parseInt(stored, 10);
    if (Number.isFinite(storedVersion) && storedVersion >= CAPABILITY_STATEMENT_VERSION) {
      setAcknowledged(true);
    }
  }, []);

  if (acknowledged) {
    return <>{children}</>;
  }

  const canContinue = isConfirmationPhraseConfirmed(typed);

  function handleContinue() {
    window.localStorage.setItem(CAPABILITY_ACK_STORAGE_KEY, String(CAPABILITY_STATEMENT_VERSION));
    setAcknowledged(true);
  }

  return (
    <div data-testid="capability-statement" className="card flex flex-col gap-md">
      <p className="kicker">Layer 1 · shown once per user, and again on every material change</p>
      <h1 className="screen">Before you use this tool</h1>
      <p className="lede">
        This tool applies fee rules that our lawyers have written down for each jurisdiction. It is
        a calculator, not a lawyer.
      </p>
      <ul data-testid="capability-bullets" className="flex flex-col gap-sm text-body">
        <li>
          <span />
          <div>
            It does <b>not know the law</b>. It applies a rule pack that a named lawyer authored
            and dated. If that rule pack is wrong or out of date, this tool will be confidently
            wrong.
          </div>
        </li>
        <li>
          <span />
          <div>
            It does <b>not decide anything</b>. Every figure it produces is a draft until a
            qualified lawyer reviews it and signs it off by name.
          </div>
        </li>
        <li>
          <span />
          <div>
            It <b>cannot see your matter</b>. It has no access to the request itself, the
            requestor, or the personal data being retrieved. It sees only the cost lines you type
            in.
          </div>
        </li>
        <li>
          <span />
          <div>
            Where the rules are unclear, or the information is thin, it will{" "}
            <b>refuse to decide</b> and refer the item to Legal. That is the tool working
            correctly, not failing.
          </div>
        </li>
        <li>
          <span />
          <div>
            No AI language model drafts any part of this build&apos;s output. Every figure and
            rationale you see comes from the deterministic engine applying the pack — never a
            model.
          </div>
        </li>
        <li>
          <span />
          <div>
            This demo <b>holds no persistent data</b>. Matters and assessments exist only in this
            server process&apos;s memory and are lost on restart or code change.
          </div>
        </li>
      </ul>
      <div className="typein">
        <label className="f" style={{ flex: "none" }}>
          <span className="lb">Type &apos;I understand&apos; to continue</span>
          <input
            className="t"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="I understand"
            autoComplete="off"
          />
        </label>
        <button type="button" className="btn btn-primary" disabled={!canContinue} onClick={handleContinue}>
          Continue to intake
        </button>
      </div>
      <p className="why-layered">
        A one-time click-through is read once and never again, so it is not the only disclosure.
        It is backed by the status strip on every screen, per-line rule provenance and citations,
        and a warning embedded in both generated documents — the places where a document like this
        actually goes wrong.
      </p>
    </div>
  );
}
