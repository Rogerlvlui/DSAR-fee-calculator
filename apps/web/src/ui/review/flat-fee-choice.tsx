// apps/web/src/ui/review/flat-fee-choice.tsx
//
// REVIEW-11's flat-fee-vs-itemised choice. Renders only when the pack
// carries a flatFeeComparison (today: HK only) — "no flat fee exists for
// this pack" is a different fact from "a flat fee exists but is blocked",
// so this component renders nothing at all (no placeholder, no disabled
// shell) when flatFeeComparison is null, per 06-UI-SPEC.md's own
// zero-one-many resolution.
//
// Split the same way disposition-controls.tsx is: a pure FlatFeeChoiceView
// (what this module's own tests render) and the stateful FlatFeeChoice
// wrapper that owns useState/useRouter/fetch — useRouter() throws outside a
// real Next.js request, so the stateful wrapper is never rendered directly
// in a test.
//
// The flat radio's disabled state is structural (the HTML `disabled`
// attribute), never merely discouraged by copy — the server's own
// setFeeChoice is the authoritative gate either way (never trust the
// client alone), but the UI must not even offer the blocked choice.
//
// The unverified-rule marker (when the pack's own flatFee.verificationStatus
// is NEEDS_VERIFICATION) and the blocked note (when flatFeeExceedsItemisedCost
// is true) are two independent facts that can both be true at once — being
// unverified is not the same fact as being blocked, and this component
// never collapses the two into one visual state.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FlatFeeComparison } from "@dsar/schemas/assessment";
import type { CurrencyCode } from "@dsar/schemas/primitives";
import type { VerificationStatus } from "@dsar/schemas/rule-pack";
import { formatMinor } from "@dsar/schemas/money";
import { UNVERIFIED_RULE_MARKER } from "./line-card.tsx";

export type FeeChoiceValue = "ITEMISED" | "FLAT";

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export interface FlatFeeChoiceViewProps {
  flatFeeComparison: FlatFeeComparison | null;
  flatFeeVerificationStatus: VerificationStatus | null;
  currency: CurrencyCode;
  selected: FeeChoiceValue | null;
  pending: boolean;
  error: string | null;
  onSelect: (value: FeeChoiceValue) => void;
  onSubmit: () => void;
}

/** Pure, props-driven — no fetch, no router, no internal state. This is
 * what flat-fee-choice.test.tsx renders directly. */
export function FlatFeeChoiceView({
  flatFeeComparison,
  flatFeeVerificationStatus,
  currency,
  selected,
  pending,
  error,
  onSelect,
  onSubmit,
}: FlatFeeChoiceViewProps) {
  if (!flatFeeComparison) return null;

  const { flatFeeAmount, itemisedDirectCostAmount, flatFeeExceedsItemisedCost } = flatFeeComparison;

  return (
    <fieldset data-testid="flat-fee-choice">
      <legend>How should this fee be charged?</legend>

      <label>
        <input
          type="radio"
          name="fee-choice"
          data-testid="flat-fee-radio-itemised"
          checked={selected === "ITEMISED"}
          disabled={pending}
          onChange={() => onSelect("ITEMISED")}
        />
        Itemised — sum of every allowed line: {formatMinor(itemisedDirectCostAmount, currency)}
      </label>

      <label>
        <input
          type="radio"
          name="fee-choice"
          data-testid="flat-fee-radio-flat"
          checked={selected === "FLAT"}
          disabled={pending || flatFeeExceedsItemisedCost}
          onChange={() => onSelect("FLAT")}
        />
        Flat fee: {formatMinor(flatFeeAmount, currency)}
        {flatFeeVerificationStatus === "NEEDS_VERIFICATION" ? (
          <span data-testid="flat-fee-unverified-marker" className="border border-dashed border-warn text-warn">
            {" "}
            {UNVERIFIED_RULE_MARKER}
          </span>
        ) : null}
      </label>

      <p data-testid="flat-fee-helper-text">
        Permitted for administrative convenience where it stays below itemised direct cost.
      </p>

      {flatFeeExceedsItemisedCost ? (
        <p data-testid="flat-fee-blocked-note" className="text-stop">
          Blocked — this flat fee exceeds itemised direct cost, which the guidance does not permit.
        </p>
      ) : null}

      {error ? (
        <p role="alert" data-testid="flat-fee-choice-error">
          Your choice wasn&apos;t saved — {error}. It still shows the previous choice.
        </p>
      ) : null}

      <button type="button" data-testid="flat-fee-choice-submit" disabled={pending || selected === null} onClick={onSubmit}>
        Save choice
      </button>
    </fieldset>
  );
}

export interface FlatFeeChoiceProps {
  assessmentId: string;
  flatFeeComparison: FlatFeeComparison | null;
  flatFeeVerificationStatus: VerificationStatus | null;
  currency: CurrencyCode;
  currentChoice: FeeChoiceValue | null;
}

export function FlatFeeChoice({
  assessmentId,
  flatFeeComparison,
  flatFeeVerificationStatus,
  currency,
  currentChoice,
}: FlatFeeChoiceProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<FeeChoiceValue | null>(currentChoice);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (selected === null) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/fee-choice`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice: selected }),
      });
      if (!response.ok) throw new Error(await readErrorMessage(response));
      router.refresh();
    } catch (submitError) {
      // Revert to the previously-persisted choice (or none) on failure —
      // never leave the UI silently showing an unsaved selection as if it
      // were the current one.
      setSelected(currentChoice);
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <FlatFeeChoiceView
      flatFeeComparison={flatFeeComparison}
      flatFeeVerificationStatus={flatFeeVerificationStatus}
      currency={currency}
      selected={selected}
      pending={pending}
      error={error}
      onSelect={setSelected}
      onSubmit={handleSubmit}
    />
  );
}
