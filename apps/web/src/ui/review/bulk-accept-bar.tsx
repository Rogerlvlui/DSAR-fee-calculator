// apps/web/src/ui/review/bulk-accept-bar.tsx
//
// The one shortcut this screen offers (PRD §10.3 / Annex A), restricted to
// supported lines whose applied rule is verified. The count always comes
// from the `eligibleLineIds` prop — computed server-side by
// listBulkAcceptableLineIds() from the real, uncoerced pack — never a
// literal in this component. At zero the control still renders, disabled:
// a control that disappears at zero leaves a viewer unable to tell whether
// it was never offered or quietly succeeded (03.1-UI-SPEC.md's zero-one-
// many requirement). The note about what bulk accept is not available for
// renders verbatim in both the zero and non-zero states.
//
// Split the same way disposition-controls.tsx is: a pure
// BulkAcceptBarView (what this module's own tests render) and the
// stateful BulkAcceptBar wrapper that owns useState/useRouter/fetch —
// useRouter() throws outside a real Next.js request, so the stateful
// wrapper is never rendered directly in a test.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  countNonWhitespaceChars,
  hasSufficientReason,
  matchesReasonStopList,
  MIN_REASON_NON_WHITESPACE_CHARS,
} from "../../domain/disposition-actions.ts";

export const BULK_ACCEPT_NOTE = "Not available for capped, unverified or flagged lines.";
export const BULK_ACCEPT_REASON_FAILURE_TEXT =
  "A reason of at least 10 characters is required — 'ok' will not do.";

export function bulkAcceptLabel(count: number): string {
  return `Accept verified supported lines (${count})`;
}

// UI-SPEC Copywriting Contract, verbatim (AC-23's stop-list half) — replaces
// BULK_ACCEPT_REASON_FAILURE_TEXT in the same counter slot whenever the
// stop-list check specifically (not just the length check) is what failed.
// Mirrors disposition-controls.tsx's own reasonStopListRejectionText.
export function reasonStopListRejectionText(matchedPhrase: string): string {
  return `That's a stock phrase, not a reason — say what you found or decided instead of '${matchedPhrase}'.`;
}

function reasonCounterText(reason: string): string {
  return `${countNonWhitespaceChars(reason)} / ${MIN_REASON_NON_WHITESPACE_CHARS} characters minimum`;
}

// Checked BEFORE the length failure — same reasoning as
// disposition-controls.tsx's own reasonCounterFailureText: every stop-list
// entry is under the 10-character minimum on its own, so a length-first
// check would always mask the more specific "stock phrase" message.
function reasonCounterFailureText(reason: string): string | null {
  const stopListMatch = matchesReasonStopList(reason);
  if (stopListMatch !== null) return reasonStopListRejectionText(stopListMatch);
  if (!hasSufficientReason(reason)) return BULK_ACCEPT_REASON_FAILURE_TEXT;
  return null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface BulkAcceptBarViewProps {
  eligibleLineIds: readonly string[];
  reason: string;
  attemptedSubmit: boolean;
  error: string | null;
  pending: boolean;
  onReasonChange: (value: string) => void;
  onSubmit: () => void;
}

/** Pure, props-driven — this is what bulk-accept-bar.test.tsx renders
 * directly. */
export function BulkAcceptBarView({
  eligibleLineIds,
  reason,
  attemptedSubmit,
  error,
  pending,
  onReasonChange,
  onSubmit,
}: BulkAcceptBarViewProps) {
  const disabled = pending || eligibleLineIds.length === 0;

  return (
    <div data-testid="bulk-accept-bar">
      <button type="button" data-testid="bulk-accept-button" disabled={disabled} onClick={onSubmit}>
        {bulkAcceptLabel(eligibleLineIds.length)}
      </button>
      <span data-testid="bulk-accept-note">{BULK_ACCEPT_NOTE}</span>

      <div data-testid="bulk-accept-reason">
        <label>
          <span>Reason</span>
          <textarea
            rows={2}
            value={reason}
            disabled={pending}
            maxLength={1000}
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </label>
        <div data-testid="bulk-accept-reason-counter">
          {attemptedSubmit ? (reasonCounterFailureText(reason) ?? reasonCounterText(reason)) : reasonCounterText(reason)}
        </div>
      </div>

      {error ? (
        <p role="alert" data-testid="bulk-accept-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export interface BulkAcceptBarProps {
  assessmentId: string;
  eligibleLineIds: readonly string[];
}

export function BulkAcceptBar({ assessmentId, eligibleLineIds }: BulkAcceptBarProps) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setAttemptedSubmit(true);
    if (!hasSufficientReason(reason) || eligibleLineIds.length === 0) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/bulk-accept`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lineIds: eligibleLineIds, reason }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <BulkAcceptBarView
      eligibleLineIds={eligibleLineIds}
      reason={reason}
      attemptedSubmit={attemptedSubmit}
      error={error}
      pending={submitting}
      onReasonChange={setReason}
      onSubmit={handleSubmit}
    />
  );
}
