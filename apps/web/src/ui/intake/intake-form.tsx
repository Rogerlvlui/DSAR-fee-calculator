// apps/web/src/ui/intake/intake-form.tsx
//
// The client component holding all HR intake form state and composing the
// four presentational pieces. On submit it posts the matter, then each
// line, then the submit route, and navigates to the confirmation page —
// every figure is still computed by the engine after this call, never
// here. This module and the four it composes import nothing from
// apps/web/src/server; the pack view arrives as a prop, already built by
// apps/web/src/server/pack-view.ts.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { JURISDICTION_CURRENCY, type CurrencyCode, type JurisdictionCode } from "@dsar/schemas/primitives";
import { FREE_TEXT_LIMITS } from "@dsar/schemas/constants";
import type { ExpenseCategoryCode } from "@dsar/schemas/taxonomy";
import type { FeePosture, FeePostureMap, VerificationStatus } from "@dsar/schemas/rule-pack";

import { MatterDetailsFields, type MatterDetailsValue } from "./matter-details-fields.tsx";
import { AttestationsPanel, type AttestationsValue } from "./attestations-panel.tsx";
import {
  ExpenseLineRepeater,
  computeLineAmountMinor,
  rateMajorToMinor,
  type ExpenseLineDraft,
  type RepeaterCategoryOption,
} from "./expense-line-repeater.tsx";
import { ClaimFooter } from "./claim-footer.tsx";

// Structurally identical to apps/web/src/server/pack-view.ts's
// IntakePackView — deliberately re-declared here rather than imported, so
// this module (under apps/web/src/ui) never imports apps/web/src/server
// (the no-server-imports-in-ui dependency-cruiser rule, 03.1-01 Task 3).
export interface IntakeFormPackView {
  packId: string;
  version: string;
  status: string;
  jurisdictionCode: JurisdictionCode;
  feePosture: FeePostureMap;
  categories: {
    categoryCode: ExpenseCategoryCode;
    label: string;
    hint: string;
    verificationStatus: VerificationStatus;
  }[];
}

export interface IntakeFormProps {
  packView: IntakeFormPackView;
  defaultReference: string;
}

const HEADS_UP_POSTURES = new Set<FeePosture>(["NO_EXPRESS_AUTHORITY", "PROHIBITED"]);

interface DisabledReasonInput {
  matterDetailsValid: boolean;
  identityVerified: boolean;
  scopeClarified: boolean;
  lines: readonly { categoryCode: ExpenseCategoryCode; description: string; quantity: number; rateMajor: string }[];
}

/**
 * Names the specific unmet condition rather than a generic sentence — a
 * disabled button with no visible reason is a dead end (PRD §10.2). Checked
 * in order: matter details, then attestations, then at-least-one-line,
 * then per-line validity.
 */
export function computeIntakeDisabledReason(input: DisabledReasonInput): string | null {
  if (!input.matterDetailsValid) {
    return "Complete the required matter details above.";
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

export function IntakeForm({ packView, defaultReference }: IntakeFormProps) {
  const router = useRouter();

  const [matterDetails, setMatterDetails] = useState<MatterDetailsValue>({
    reference: defaultReference,
    jurisdictionCode: packView.jurisdictionCode,
    legalEntity: "",
    controllerType: "PRIVATE_ORGANISATION",
    requestReceivedOn: new Date().toISOString().slice(0, 10),
    requestorClass: "FORMER_EMPLOYEE",
  });
  const [attestations, setAttestations] = useState<AttestationsValue>({
    identityVerified: false,
    identityVerifiedNote: "",
    scopeClarified: false,
    isKnownDisputeOrLitigation: false,
  });
  const [lines, setLines] = useState<ExpenseLineDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currency: CurrencyCode = JURISDICTION_CURRENCY[matterDetails.jurisdictionCode];

  const feePosture: FeePosture =
    matterDetails.jurisdictionCode === packView.jurisdictionCode
      ? packView.feePosture[matterDetails.controllerType]
      : "NO_EXPRESS_AUTHORITY";

  const matterDetailsValid =
    matterDetails.reference.trim().length > 0 &&
    matterDetails.legalEntity.trim().length > 0 &&
    matterDetails.requestReceivedOn.length > 0;

  const disabledReason = computeIntakeDisabledReason({
    matterDetailsValid,
    identityVerified: attestations.identityVerified,
    scopeClarified: attestations.scopeClarified,
    lines,
  });

  const claimedTotalMinor = lines.reduce((total, line) => total + computeLineAmountMinor(line, currency), 0);

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
          identityVerifiedNote: attestations.identityVerifiedNote || null,
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

      router.push(`/matters/${matter.id}/submitted`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div data-testid="intake-form">
      <MatterDetailsFields value={matterDetails} onChange={setMatterDetails} currency={currency} feePosture={feePosture} />

      {matterDetailsValid ? (
        <>
          <AttestationsPanel
            value={attestations}
            onChange={setAttestations}
            noteMaxLength={FREE_TEXT_LIMITS.identityVerifiedNote}
          />
          <ExpenseLineRepeater
            lines={lines}
            onChange={setLines}
            categories={packView.categories}
            currency={currency}
          />
        </>
      ) : null}

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
