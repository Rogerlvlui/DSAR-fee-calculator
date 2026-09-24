// apps/web/src/ui/review/assessment-view.tsx
//
// The three-region legal review screen (PRD §10.3): the matter/pack context
// rail on the left, the sorted stack of line cards in the centre, and the
// totals rail (with the suppressed-while-pending headline) on the right.
// Cards are ordered by the domain's compareByVerdict comparator — never by
// the position a line happens to occupy in assessment.lines. Expands Plan
// 01's minimal version (03.1-01); keeps its props-in/markup-out shape and
// imports nothing from apps/web/src/server.

import type { ReactNode } from "react";
import type { Assessment } from "@dsar/schemas/assessment";
import type { ExpenseUnit } from "@dsar/schemas/expense-line";
import type { RequestorClass } from "@dsar/schemas/matter";
import type { ControllerType, Minor, MatterFlag } from "@dsar/schemas/primitives";
import type { CurrencyCode } from "@dsar/schemas/primitives";
import type { FeePosture, VerificationStatus } from "@dsar/schemas/rule-pack";
import { compareByVerdict } from "../../domain/verdict-order.ts";
import { LineCard } from "./line-card.tsx";
import { ReviewKeyboardScope } from "./review-keyboard-scope.tsx";
import { MatterRail, type MatterRailAdvisoryDeadline } from "./matter-rail.tsx";
import { PackRail } from "./pack-rail.tsx";
import { TotalsRail } from "./totals-rail.tsx";

export interface AssessmentViewLineDetail {
  assessmentLineId: string;
  seq: number;
  categoryLabel: string;
  description: string;
  quantity: number;
  unit: ExpenseUnit;
  unitRate: Minor;
  claimedAmount: Minor;
  verificationStatus: VerificationStatus;
}

export interface AssessmentViewMatter {
  reference: string;
  jurisdictionName: string;
  legalEntity: string;
  controllerType: ControllerType;
  requestReceivedOn: string;
  requestorClass: RequestorClass;
  identityVerified: boolean;
  identityVerifiedNote: string | null;
  scopeClarified: boolean;
}

export interface AssessmentViewPack {
  packId: string;
  version: string;
  status: string;
  feePosture: FeePosture;
  authoredByDisplayName: string | null;
  reviewedByDisplayName: string | null;
  reviewedOn: string | null;
  reviewDueOn: string;
  openQuestions: readonly string[];
}

export interface AssessmentViewProps {
  assessment: Assessment;
  currency: CurrencyCode;
  lineDetails: readonly AssessmentViewLineDetail[];
  matterFlags: readonly MatterFlag[];
  advisoryDeadline: MatterRailAdvisoryDeadline | null;
  matter: AssessmentViewMatter;
  pack: AssessmentViewPack;
  /** Per-line disposition controls, keyed by assessment line id — composed
   * here (Task 2/3 of this plan) so this module still never imports
   * apps/web/src/server, and disposition-controls.tsx/bulk-accept-bar.tsx
   * never import this module either. */
  renderLineControls?: (assessmentLineId: string) => ReactNode;
  bulkAcceptBar?: ReactNode;
  /** The sign-off panel, composed by the caller (Plan 05's integration
   * pass) exactly the way renderLineControls/bulkAcceptBar already are —
   * this module still never imports apps/web/src/server, and
   * signoff-panel.tsx never imports this module either. Rendered only once
   * the caller itself has decided every line is decided (this component
   * does not re-derive that condition). */
  signOffPanel?: ReactNode;
  /** The "Download internal record (PDF)" trigger (07-05), composed by
   * the caller in the SAME position signOffPanel occupies — the caller
   * (apps/web/app/legal/assessments/[id]/page.tsx) decides which of the
   * two is non-null based on matter.status, never both at once; this
   * component does not re-derive that condition either. */
  internalRecordDownload?: ReactNode;
  /** REVIEW-11's flat-fee-vs-itemised choice, composed by the caller
   * (Plan 06-07) exactly the way renderLineControls/bulkAcceptBar/
   * signOffPanel already are — this module still never imports
   * apps/web/src/server, and flat-fee-choice.tsx never imports this module
   * either. Rendered directly above the headline block, per 06-UI-SPEC.md's
   * own stated visual-focal-point rule. */
  flatFeeChoice?: ReactNode;
  /** AC-39's in-flight-review stale-pack notice (07-05), composed by the
   * caller exactly the way every other composition slot already is.
   * Rendered directly above recomputeBanner, above the cards region, so a
   * lawyer reads the pack's review state before any other banner. */
  stalePackNotice?: ReactNode;
  /** REVIEW-10's recompute-against-current-pack confirmation banner,
   * composed by the caller (Plan 06-07) exactly the way every other
   * composition slot already is. Rendered above the cards region, per
   * 06-UI-SPEC.md's spacing note (md top margin — same rhythm as the
   * existing matter-flag treatment). */
  recomputeBanner?: ReactNode;
}

export function AssessmentView({
  assessment,
  currency,
  lineDetails,
  matterFlags,
  advisoryDeadline,
  matter,
  pack,
  renderLineControls,
  bulkAcceptBar,
  signOffPanel,
  internalRecordDownload,
  flatFeeChoice,
  stalePackNotice,
  recomputeBanner,
}: AssessmentViewProps) {
  const detailByLineId = new Map(lineDetails.map((detail) => [detail.assessmentLineId, detail]));
  const sortedLines = [...assessment.lines].sort(compareByVerdict);
  const pendingCount = assessment.lines.filter((line) => line.disposition === "PENDING").length;

  return (
    <div data-testid="assessment-view" className="review-grid">
      <div className="review-grid-rails">
        <MatterRail
          reference={matter.reference}
          jurisdictionName={matter.jurisdictionName}
          legalEntity={matter.legalEntity}
          controllerType={matter.controllerType}
          requestReceivedOn={matter.requestReceivedOn}
          requestorClass={matter.requestorClass}
          identityVerified={matter.identityVerified}
          identityVerifiedNote={matter.identityVerifiedNote}
          scopeClarified={matter.scopeClarified}
          matterFlags={matterFlags}
          advisoryDeadline={advisoryDeadline}
        />

        <PackRail
          packId={pack.packId}
          version={pack.version}
          status={pack.status}
          feePosture={pack.feePosture}
          authoredByDisplayName={pack.authoredByDisplayName}
          reviewedByDisplayName={pack.reviewedByDisplayName}
          reviewedOn={pack.reviewedOn}
          reviewDueOn={pack.reviewDueOn}
          openQuestions={pack.openQuestions}
        />
      </div>

      <div className="review-grid-main">
        <p className="review-progress" data-testid="review-progress">
          {pendingCount > 0
            ? `${pendingCount} line${pendingCount === 1 ? "" : "s"} need a decision. The recommended fee stays hidden until every line is decided.`
            : "Every line has a decision. Review the totals before sign-off."}
        </p>
        {stalePackNotice}
        {recomputeBanner}
        <div data-testid="cards-region">
          {bulkAcceptBar}
          <ReviewKeyboardScope lineIds={sortedLines.map((line) => line.id)}>
            <div data-testid="assessment-lines" className="flex flex-col gap-md">
              {sortedLines.map((line) => {
                const detail = detailByLineId.get(line.id);
                if (!detail) return null;
                return (
                  <LineCard
                    key={line.id}
                    line={line}
                    seq={detail.seq}
                    categoryLabel={detail.categoryLabel}
                    description={detail.description}
                    quantity={detail.quantity}
                    unit={detail.unit}
                    unitRate={detail.unitRate}
                    claimedAmount={detail.claimedAmount}
                    currency={currency}
                    verificationStatus={detail.verificationStatus}
                  >
                    {renderLineControls ? renderLineControls(line.id) : null}
                  </LineCard>
                );
              })}
            </div>
          </ReviewKeyboardScope>
        </div>

        {flatFeeChoice}
      </div>

      <div className="review-grid-totals">
        <TotalsRail assessment={assessment} currency={currency} />
        {signOffPanel}
        {internalRecordDownload}
      </div>
    </div>
  );
}
