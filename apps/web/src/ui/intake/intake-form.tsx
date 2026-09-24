// apps/web/src/ui/intake/intake-form.tsx
//
// The client component holding all HR intake form state and composing the
// four presentational pieces. On submit it posts the matter, then each
// line, then the submit route, and navigates to the confirmation page —
// every figure is still computed by the engine after this call, never
// here. This module and the four it composes import nothing from
// apps/web/src/server; all nine jurisdictions' pack views arrive as a prop
// (packsByJurisdiction), already built server-side by
// apps/web/src/server/jurisdiction-packs.ts.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JURISDICTION_CURRENCY, type CurrencyCode, type JurisdictionCode } from "@dsar/schemas/primitives";
import type { ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import type { FeePosture, FeePostureMap, VerificationStatus } from "@dsar/schemas/rule-pack";

import {
  MatterDetailsFields,
  canOfferExpenseEntry,
  type MatterDetailsValue,
} from "./matter-details-fields.tsx";
import { humanizePackDisplayStatus } from "../../domain/pack-display-status.ts";
import { AttestationsPanel, type AttestationsValue } from "./attestations-panel.tsx";
import {
  ExpenseLineRepeater,
  computeLineAmountMinor,
  rateMajorToMinor,
  type ExpenseLineDraft,
  type RepeaterCategoryOption,
} from "./expense-line-repeater.tsx";
import { CategorizationSummary } from "./categorization-summary.tsx";
import { ClaimFooter } from "./claim-footer.tsx";
import { StatusStrip } from "../chrome/status-strip.tsx";
import { useDraftAutosave } from "./use-draft-autosave.ts";
import { AutosaveIndicator } from "./autosave-indicator.tsx";

// Module-level so a future caller (or a test asserting on it) has one name
// to import, rather than a re-typed literal.
export const INTAKE_DRAFT_STORAGE_KEY = "dsar_demo_intake_draft";

// Structurally identical to apps/web/src/server/jurisdiction-packs.ts's
// JurisdictionPackView — deliberately re-declared here rather than
// imported, so this module (under apps/web/src/ui) never imports
// apps/web/src/server (the no-server-imports-in-ui dependency-cruiser rule,
// 03.1-01 Task 3). Same precedent as MatterDetailsJurisdictionPack.
export interface IntakeFormJurisdictionPackView {
  jurisdictionCode: JurisdictionCode;
  jurisdictionName: string;
  packId: string | null;
  version: string | null;
  displayStatus: "ACTIVE" | "ACTIVE_REVIEW_DUE_SOON" | "STALE" | "DRAFT" | "NO_USABLE_PACK";
  daysUntilReviewDue: number | null;
  feePosture: FeePostureMap | null;
  constraints: { feeNotificationDeadlineDays: number | null; responseDeadlineDays: number | null } | null;
  authoredByDisplayName: string | null;
  reviewedByDisplayName: string | null;
  reviewedOn: string | null;
  categories: {
    categoryCode: ExpenseCategoryCode;
    label: string;
    hint: string;
    verificationStatus: VerificationStatus;
  }[];
}

export interface IntakeFormProps {
  packsByJurisdiction: Record<JurisdictionCode, IntakeFormJurisdictionPackView>;
  defaultReference: string;
}

const HEADS_UP_POSTURES = new Set<FeePosture>(["NO_EXPRESS_AUTHORITY", "PROHIBITED"]);

interface DisabledReasonInput {
  matterDetailsValid: boolean;
  // Optional, defaulting to true (usable) — WR-01 (05-REVIEW-ADDENDUM.md):
  // the caller passes canOfferExpenseEntry(jurisdictionPack, controllerType)
  // here so a STALE (or otherwise unusable) pack disables Submit the same
  // way it already hides the expense-line repeater, rather than only
  // surfacing as the unhelpful generic "Add at least one cost line." once
  // the repeater silently disappears. Optional so existing call sites that
  // never resolved a jurisdiction pack are unaffected.
  canOfferExpenseEntry?: boolean;
  identityVerified: boolean;
  scopeClarified: boolean;
  lines: readonly { categoryCode: ExpenseCategoryCode; description: string; quantity: number; rateMajor: string }[];
}

/**
 * Names the specific unmet condition rather than a generic sentence — a
 * disabled button with no visible reason is a dead end (PRD §10.2). Checked
 * in order: matter details, then the jurisdiction's usability for cost
 * entry, then attestations, then at-least-one-line, then per-line validity.
 */
export function computeIntakeDisabledReason(input: DisabledReasonInput): string | null {
  if (!input.matterDetailsValid) {
    return "Complete the required matter details above.";
  }
  if (input.canOfferExpenseEntry === false) {
    return "This jurisdiction's rule pack does not currently permit new cost entries for this claim.";
  }
  if (!input.identityVerified) {
    return "Confirm the requestor's identity has been verified.";
  }
  if (!input.scopeClarified) {
    return "Confirm the scope of the request is clear, or that clarifications have been resolved.";
  }
  if (input.lines.length === 0) {
    return "Add at least one cost line.";
  }
  const invalidLine = input.lines.find(
    (line) => !line.description.trim() || line.quantity <= 0 || Number.parseFloat(line.rateMajor) <= 0
  );
  if (invalidLine) {
    return "Fix the highlighted cost line before submitting.";
  }
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

export function IntakeForm({ packsByJurisdiction, defaultReference }: IntakeFormProps) {
  const router = useRouter();

  const [matterDetails, setMatterDetails] = useState<MatterDetailsValue>({
    reference: defaultReference,
    // Every jurisdiction is now resolved equally — no privileged "the"
    // pack to derive a default from — so SG is a literal default reference
    // point, not a derived one.
    jurisdictionCode: "SG",
    legalEntity: "",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: new Date().toISOString().slice(0, 10),
    requestorClass: "FORMER_EMPLOYEE",
  });
  const [attestations, setAttestations] = useState<AttestationsValue>({
    identityVerified: false,
    scopeClarified: false,
    isKnownDisputeOrLitigation: false,
  });
  const [lines, setLines] = useState<ExpenseLineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currency: CurrencyCode = JURISDICTION_CURRENCY[matterDetails.jurisdictionCode];

  const currentJurisdictionPack = packsByJurisdiction[matterDetails.jurisdictionCode];

  const matterDetailsValid =
    matterDetails.reference.trim().length > 0 &&
    matterDetails.legalEntity.trim().length > 0 &&
    matterDetails.requestReceivedOn.length > 0;

  const disabledReason = computeIntakeDisabledReason({
    matterDetailsValid,
    canOfferExpenseEntry: canOfferExpenseEntry(currentJurisdictionPack, matterDetails.controllerType),
    identityVerified: attestations.identityVerified,
    scopeClarified: attestations.scopeClarified,
    lines,
  });

  const claimedTotalMinor = lines.reduce((total, line) => total + computeLineAmountMinor(line, currency), 0);

  // INTAKE-09 — a 10-second client-local autosave, write-only (no
  // restore-on-reload; see this component's own SUMMARY for the deliberate
  // scope line). Never reaches the network or this codebase's audit log.
  const autosave = useDraftAutosave(INTAKE_DRAFT_STORAGE_KEY, { matterDetails, attestations, lines });

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const matterResponse = await fetch("/api/matters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reference: matterDetails.reference,
          jurisdictionCode: matterDetails.jurisdictionCode,
          legalEntity: matterDetails.legalEntity,
          controllerType: matterDetails.controllerType,
          requestReceivedOn: matterDetails.requestReceivedOn,
          requestorClass: matterDetails.requestorClass,
          currency,
          identityVerified: attestations.identityVerified,
          identityVerifiedNote: null,
          scopeClarified: attestations.scopeClarified,
          isRepeatRequestWithin12Months: false,
          isKnownDisputeOrLitigation: attestations.isKnownDisputeOrLitigation,
        }),
      });
      if (!matterResponse.ok) throw new Error(await readErrorMessage(matterResponse));
      const matter = (await matterResponse.json()) as { id: string };

      for (const line of lines) {
        const lineResponse = await fetch(`/api/matters/${matter.id}/lines`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            categoryCode: line.categoryCode,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            unitRate: rateMajorToMinor(line.rateMajor, currency),
            incurredByGrade: line.incurredByGrade,
            isThirdPartyInvoiced: line.isThirdPartyInvoiced,
            vendorName: line.vendorName || null,
            evidenceRef: line.evidenceRef || null,
            hrNote: null,
          }),
        });
        if (!lineResponse.ok) throw new Error(await readErrorMessage(lineResponse));
      }

      const submitResponse = await fetch(`/api/matters/${matter.id}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!submitResponse.ok) throw new Error(await readErrorMessage(submitResponse));

      // The autosaved draft can carry free-text line descriptions and must
      // not persist in localStorage indefinitely once the matter it was
      // drafting is already submitted. Cleared immediately before
      // navigating away, mirroring this module's own "never reaches the
      // network or the audit log" write-only autosave boundary.
      window.localStorage.removeItem(INTAKE_DRAFT_STORAGE_KEY);

      router.push(`/hr/matters/${matter.id}/submitted`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="intake-form" className="flex flex-col gap-xl">
      <AutosaveIndicator status={autosave.status} savedAt={autosave.savedAt} />
      <StatusStrip
        matterReference={matterDetails.reference}
        jurisdictionName={currentJurisdictionPack.jurisdictionName}
        rulePackId={currentJurisdictionPack.packId ?? "—"}
        rulePackVersion={currentJurisdictionPack.version ?? "—"}
        packStatus={humanizePackDisplayStatus(currentJurisdictionPack.displayStatus)}
        authoredByDisplayName={currentJurisdictionPack.authoredByDisplayName}
        reviewedByDisplayName={currentJurisdictionPack.reviewedByDisplayName}
        reviewedOn={currentJurisdictionPack.reviewedOn}
        // A jurisdiction with no usable pack has no review-due date to
        // speak of; a large positive number reads as unremarkable rather
        // than alarming, rather than inventing a stale/urgent tone for a
        // jurisdiction that was never usable in the first place.
        daysUntilReviewDue={currentJurisdictionPack.daysUntilReviewDue ?? 9999}
      />
      <MatterDetailsFields
        value={matterDetails}
        onChange={setMatterDetails}
        currency={currency}
        jurisdictionPack={currentJurisdictionPack}
      />

      {matterDetailsValid && canOfferExpenseEntry(currentJurisdictionPack, matterDetails.controllerType) ? (
        <>
          <ExpenseLineRepeater
            lines={lines}
            onChange={setLines}
            categories={currentJurisdictionPack.categories}
            currency={currency}
          />
          <CategorizationSummary lines={lines} currency={currency} />
        </>
      ) : null}

      {matterDetailsValid ? <AttestationsPanel value={attestations} onChange={setAttestations} /> : null}

      <ClaimFooter
        claimedTotalMinor={claimedTotalMinor}
        currency={currency}
        disabledReason={disabledReason}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      {submitError ? <p role="alert">{submitError}</p> : null}
    </div>
  );
}

// Re-exported so the confirmation heads-up condition set is visible from
// one place to a caller that needs it (none in this plan; kept for the
// same reason PRD §10.2 keeps the two postures grouped together).
export const INTAKE_HEADS_UP_POSTURES = HEADS_UP_POSTURES;
