// apps/web/src/ui/review/disposition-controls.tsx
//
// The per-verdict control set (PRD §10.3): ALLOW/ALLOW_CAPPED lines get
// Accept / Reduce / Strike; FLAG lines get Allow-with-amount / Strike /
// Ask HR; DISALLOW lines get Accept / Allow-anyway. The inline reason
// textarea is the confirmation — no modal, ever, because "modals train
// people to type 'ok'". While a request is in flight every control renders
// disabled so a double-click cannot submit twice; on failure the card
// renders an inline error, stays editable and stays pending. After a
// successful post the smart wrapper refreshes the server-rendered route
// (`router.refresh()`) rather than computing a new total locally — the
// browser must never derive a figure the server has not blessed.
//
// "Ask HR" (FLAG lines only) posts to the info-request route with the same
// reason field used for every other action, treated as the lawyer's query —
// wired in Plan 05's integration pass (WINDOWS.md entry 5); askHr() and its
// route have existed since Plan 04.
//
// Split in two, following apps/web/src/ui/intake/intake-form.tsx's own
// precedent for a stateful, `useRouter()`-calling component: `useRouter()`
// throws ("invariant expected app router to be mounted") under a bare
// `renderToStaticMarkup()` outside a real Next request, so the presentational
// half (`DispositionControlsView`) takes every value and callback as a prop
// and is what this module's own tests render directly; the exported
// `DispositionControls` owns useState/useRouter/fetch and is only ever
// exercised through the real app (and, indirectly, through the disposition
// route's own tests, which drive the route handler it calls).

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Verdict } from "@dsar/schemas/assessment";
import type { CurrencyCode } from "@dsar/schemas/primitives";
import { MINOR_UNIT_DECIMALS } from "@dsar/schemas/money";
import {
  countNonWhitespaceChars,
  hasSufficientAndGenuineReason,
  hasSufficientReason,
  matchesReasonStopList,
  MIN_REASON_NON_WHITESPACE_CHARS,
  VERDICT_ACTIONS,
  type DispositionAction,
} from "../../domain/disposition-actions.ts";

const REASON_LABEL: Record<Verdict, string> = {
  ALLOW: "Required for Reduce or Strike; optional for Accept",
  ALLOW_CAPPED: "Required for Reduce or Strike; optional for Accept",
  FLAG: "Required for this decision",
  DISALLOW: "Required to allow anyway; optional for Accept",
};

const ACTION_LABEL: Record<DispositionAction, (currency: CurrencyCode) => string> = {
  ACCEPT: () => "Accept",
  REDUCE: () => "Reduce",
  STRIKE: () => "Strike",
  ALLOW_WITH_AMOUNT: (currency) => `Allow ${currency}`,
  ALLOW_ANYWAY: (currency) => `Allow anyway ${currency}`,
};

const ACTIONS_TAKING_AMOUNT = new Set<DispositionAction>(["REDUCE", "ALLOW_WITH_AMOUNT", "ALLOW_ANYWAY"]);

export const REASON_COUNTER_FAILURE_TEXT = "A reason of at least 10 characters is required — 'ok' will not do.";

// UI-SPEC Copywriting Contract, verbatim (AC-23's stop-list half) — replaces
// REASON_COUNTER_FAILURE_TEXT in the same counter slot whenever the
// stop-list check specifically (not just the length check) is what failed.
export function reasonStopListRejectionText(matchedPhrase: string): string {
  return `That's a stock phrase, not a reason — say what you found or decided instead of '${matchedPhrase}'.`;
}

function reasonCounterText(reason: string): string {
  return `${countNonWhitespaceChars(reason)} / ${MIN_REASON_NON_WHITESPACE_CHARS} characters minimum`;
}

// Checked BEFORE the length failure (see apps/web/src/server/data/
// assessments.ts's assertSufficientReason for why: every stop-list entry is
// under the 10-character minimum on its own, so a length-first check would
// never let a lawyer see the more specific "stock phrase" message at all —
// it would always be masked by the generic "too short" one first).
function reasonCounterFailureText(reason: string): string | null {
  const stopListMatch = matchesReasonStopList(reason);
  if (stopListMatch !== null) return reasonStopListRejectionText(stopListMatch);
  if (!hasSufficientReason(reason)) return REASON_COUNTER_FAILURE_TEXT;
  return null;
}

export function majorToMinor(major: string, currency: CurrencyCode): number {
  const decimals = MINOR_UNIT_DECIMALS[currency];
  const parsed = Number.parseFloat(major);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 10 ** decimals);
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface DispositionControlsViewProps {
  verdict: Verdict;
  currency: CurrencyCode;
  reason: string;
  amountMajor: string;
  attemptedSubmit: boolean;
  error: string | null;
  /** True while a submit is in flight OR forced by the caller (e.g. a
   * test) — every action control renders disabled while this is true. */
  pending: boolean;
  onReasonChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onSubmit: (action: DispositionAction) => void;
  /** FLAG lines only. Optional so this module's own colocated test (which
   * renders every verdict without passing this) keeps compiling — the
   * button still renders either way, disabled while pending, a no-op click
   * when absent. */
  onAskHr?: () => void;
}

/** Pure, props-driven — no fetch, no router, no internal state. This is
 * what disposition-controls.test.tsx renders directly. */
export function DispositionControlsView({
  verdict,
  currency,
  reason,
  amountMajor,
  attemptedSubmit,
  error,
  pending,
  onReasonChange,
  onAmountChange,
  onSubmit,
  onAskHr,
}: DispositionControlsViewProps) {
  const actions = VERDICT_ACTIONS[verdict];

  return (
    <div data-testid="disposition-controls" className="flex flex-col gap-sm">
      <div data-testid="disposition-action-buttons" className="flex flex-wrap gap-xs">
        {actions.map((action) => {
          const isPrimary = action === "ACCEPT" || action === "ALLOW_WITH_AMOUNT" || action === "ALLOW_ANYWAY";
          const actionBtnClass = isPrimary ? "btn btn-primary" : "btn btn-secondary";
          return ACTIONS_TAKING_AMOUNT.has(action) ? (
            <span key={action} className="flex items-center gap-xs">
              <label className="flex items-center gap-xs">
                <span className="hint">{ACTION_LABEL[action](currency)}</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={amountMajor}
                  disabled={pending}
                  onChange={(event) => onAmountChange(event.target.value)}
                />
              </label>
              <button
                type="button"
                data-testid="disposition-action"
                data-action={action.toLowerCase()}
                disabled={pending}
                className={actionBtnClass}
                onClick={() => onSubmit(action)}
              >
                {ACTION_LABEL[action](currency)}
              </button>
            </span>
          ) : (
            <button
              key={action}
              type="button"
              data-testid="disposition-action"
              data-action={action.toLowerCase()}
              disabled={pending}
              className={actionBtnClass}
              onClick={() => onSubmit(action)}
            >
              {ACTION_LABEL[action](currency)}
            </button>
          );
        })}

        {verdict === "FLAG" ? (
          // The reason field above doubles as the lawyer's query: askHr()
          // (apps/web/src/server/data/assessments.ts) applies the same
          // minimum-length rule to it that every other disposition reason
          // gets.
          <button
            type="button"
            data-testid="disposition-action"
            data-action="ask-hr"
            disabled={pending}
            className="btn btn-secondary"
            onClick={() => onAskHr?.()}
          >
            Ask HR
          </button>
        ) : null}
      </div>

      <div data-testid="disposition-reason">
        <label>
          <span className="hint">
            Reason <b>{REASON_LABEL[verdict]}</b>
          </span>
          <textarea
            rows={2}
            value={reason}
            disabled={pending}
            maxLength={1000}
            className="bg-surface border-line border"
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </label>
        <div data-testid="disposition-reason-counter" className="hint">
          {attemptedSubmit ? (reasonCounterFailureText(reason) ?? reasonCounterText(reason)) : reason.length > 0 || verdict === "FLAG" ? reasonCounterText(reason) : "10 characters for a required reason"}
        </div>
      </div>

      {error ? (
        <p role="alert" data-testid="disposition-error" className="hint stern">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface DispositionControlsProps {
  assessmentLineId: string;
  verdict: Verdict;
  currency: CurrencyCode;
  /** The matter this line's assessment belongs to — only used to build the
   * Ask HR request's URL path; askHr() itself resolves the matter from the
   * line id, the same lookup dispositionLine() already uses. */
  matterId: string;
  /** External/test-driven in-flight flag — ORed with this component's own
   * submitting state. */
  pending?: boolean;
}

export function DispositionControls({
  assessmentLineId,
  verdict,
  currency,
  matterId,
  pending: externalPending = false,
}: DispositionControlsProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [amountMajor, setAmountMajor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(action: DispositionAction) {
    const needsReason = action !== "ACCEPT" || verdict === "FLAG" || reason.trim().length > 0;
    setAttemptedSubmit(needsReason);
    // IN-01: the shared combined check (length AND not-a-stock-phrase), not
    // a length-only reimplementation — every stop-list entry is already
    // under the length minimum on its own, so this was never a behavior
    // change, only closing the drift-risk of two independent copies.
    if (needsReason && !hasSufficientAndGenuineReason(reason)) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessment-lines/${assessmentLineId}/disposition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          reason: reason.trim() || null,
          ...(ACTIONS_TAKING_AMOUNT.has(action) ? { amountMinor: majorToMinor(amountMajor, currency) } : {}),
        }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  async function handleAskHr() {
    setAttemptedSubmit(true);
    // IN-01: see handleSubmit's own note above.
    if (!hasSufficientAndGenuineReason(reason)) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/info-request`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentLineId, query: reason }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <DispositionControlsView
      verdict={verdict}
      currency={currency}
      reason={reason}
      amountMajor={amountMajor}
      attemptedSubmit={attemptedSubmit}
      error={error}
      pending={externalPending || submitting}
      onReasonChange={setReason}
      onAmountChange={setAmountMajor}
      onSubmit={handleSubmit}
      onAskHr={handleAskHr}
    />
  );
}
