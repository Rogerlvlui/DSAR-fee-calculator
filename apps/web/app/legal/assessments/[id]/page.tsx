// apps/web/app/legal/assessments/[id]/page.tsx
//
// An async server component: await the route params, resolve the actor,
// call getAssessmentForLegalReview, load the untransformed pack this
// assessment was actually PINNED to with resolvePinnedRulePack() (by the
// assessment's own rulePackId/rulePackVersion, never "whichever pack is
// current"), build the review view (apps/web/src/server/review-view.ts)
// and pass plain props down to the status strip and the assessment view.
// The page fetches and authorises; it renders nothing itself beyond
// composition. The pack status it hands both the strip and the pack rail
// comes from the untransformed load result — never the engine-invocation
// boundary's coerced copy.
//
// The sign-off panel (built and tested since Plan 04, wired here in Plan
// 05's integration pass — WINDOWS.md entry 6) is composed the same way
// renderLineControls/bulkAcceptBar already are: this page computes the
// review-time preview (tallies, the not-yet-signed-off final amount, the
// attestation text) from the SAME pure modules signOff() itself calls, so
// what the lawyer reads here is never a second, drifting computation.

import type { ReactNode } from "react";
import { deriveEffectiveStatus, daysUntilReviewDue } from "@dsar/rulepacks/stale";
import { getCurrentActor } from "../../../../src/server/current-actor.ts";
import { getAssessmentForLegalReview, listBulkAcceptableLineIds } from "../../../../src/server/data/assessments.ts";
import { resolveCurrentPackForJurisdiction, resolvePinnedRulePack } from "../../../../src/server/engine-invocation.ts";
import { buildReviewView } from "../../../../src/server/review-view.ts";
import { memoryMatterRepository } from "../../../../src/server/repositories/memory/matter-repository.ts";
import { NotFoundError } from "../../../../src/server/errors.ts";
import { computeFinalAmount, computeReviewTallies } from "../../../../src/domain/review-tallies.ts";
import { renderAttestation } from "../../../../src/domain/attestation.ts";
import { StatusStrip } from "../../../../src/ui/chrome/status-strip.tsx";
import { AssessmentView } from "../../../../src/ui/review/assessment-view.tsx";
import { DispositionControls } from "../../../../src/ui/review/disposition-controls.tsx";
import { BulkAcceptBar } from "../../../../src/ui/review/bulk-accept-bar.tsx";
import { SignOffPanel } from "../../../../src/ui/review/signoff-panel.tsx";
import { FlatFeeChoice } from "../../../../src/ui/review/flat-fee-choice.tsx";
import { RecomputeConfirm } from "../../../../src/ui/review/recompute-confirm.tsx";
import { shouldRenderRecomputeBanner } from "../../../../src/domain/recompute-banner.ts";

export default async function LegalAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // decodeURIComponent: assessment ids are colon-joined
  // (`assessment:{matterId}:{packId}:{packVersion}:{timestamp}`,
  // packages/engine's deriveAssessmentId) and Next's dynamic-segment param
  // arrives percent-encoded rather than auto-decoded under this app's
  // current Turbopack dev setup — confirmed live: an unencoded lookup 404s.
  // No test in this phase catches this class of bug, since every route
  // test drives handlers directly with a hand-built params object,
  // bypassing real URL decoding entirely.
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const actor = await getCurrentActor();
  const assessment = await getAssessmentForLegalReview(actor, id);
  const matter = await memoryMatterRepository.getMatter(assessment.matterId);
  if (!matter) {
    throw new NotFoundError(`No matter found for assessment '${id}'`);
  }
  const expenseLines = await memoryMatterRepository.listExpenseLines(assessment.matterId);
  const pack = resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion);
  const reviewView = buildReviewView(assessment, matter, expenseLines);
  const eligibleLineIds = listBulkAcceptableLineIds(assessment);

  // REVIEW-10: resolveCurrentPackForJurisdiction (Plan 06-01) reused
  // verbatim — never a second, parallel "get the current pack" mechanism.
  // This condition is honestly always false against every real committed
  // pack today: each has exactly one version file (06-RESEARCH.md
  // Pitfall 5), so the banner never renders yet — correctly, not a bug to
  // work around. It is already correct and waiting for the day a second
  // real pack version file exists.
  const currentPack = resolveCurrentPackForJurisdiction(matter.jurisdictionCode);
  const showRecomputeBanner = shouldRenderRecomputeBanner(assessment.rulePackVersion, currentPack.version);

  const now = new Date().toISOString();
  const pendingCount = assessment.lines.filter((line) => line.disposition === "PENDING").length;
  let signOffPanel: ReactNode = null;
  if (pendingCount === 0) {
    const tallies = computeReviewTallies(assessment.lines);
    // Same feeChoice-aware logic signOff() itself calls (CR-01) — the
    // preview shown here must never drift from what sign-off would
    // actually record.
    const finalAmount = computeFinalAmount(
      assessment.lines,
      assessment.feeChoice ?? null,
      assessment.totals.flatFeeComparison ?? null
    );
    const flagsRequiringAck = assessment.matterLevelFlags.filter((flag) => flag.requiresAcknowledgement);
    const packIsStale = deriveEffectiveStatus(pack, now) === "STALE";
    const attestationText = renderAttestation({
      jurisdiction: pack.jurisdiction.name,
      packId: assessment.rulePackId,
      packVersion: assessment.rulePackVersion,
      reviewedOn: pack.reviewedOn,
      packIsStale,
    });
    signOffPanel = (
      <SignOffPanel
        assessmentId={assessment.id}
        tallies={tallies}
        finalAmount={finalAmount}
        currency={matter.currency}
        flagsRequiringAck={flagsRequiringAck}
        attestationText={attestationText}
        reviewedOnNotRecorded={pack.reviewedOn === null}
        lawyerName={actor.user.displayName}
      />
    );
  }

  return (
    <main>
      <h1>Fee assessment — {matter.reference}</h1>
      <StatusStrip
        matterReference={matter.reference}
        jurisdictionName={pack.jurisdiction.name}
        rulePackId={pack.packId}
        rulePackVersion={pack.version}
        packStatus={pack.status}
        authoredByDisplayName={pack.authoredBy?.displayName ?? null}
        reviewedByDisplayName={pack.reviewedBy?.displayName ?? null}
        reviewedOn={pack.reviewedOn}
        daysUntilReviewDue={daysUntilReviewDue(pack, now)}
      />
      <AssessmentView
        assessment={assessment}
        currency={matter.currency}
        lineDetails={reviewView.lines}
        matterFlags={reviewView.matterFlags}
        advisoryDeadline={reviewView.advisoryDeadline}
        matter={{
          reference: matter.reference,
          jurisdictionName: pack.jurisdiction.name,
          legalEntity: matter.legalEntity,
          controllerType: matter.controllerType,
          requestReceivedOn: matter.requestReceivedOn,
          requestorClass: matter.requestorClass,
          identityVerified: matter.identityVerified,
          identityVerifiedNote: matter.identityVerifiedNote,
          scopeClarified: matter.scopeClarified,
        }}
        pack={{
          packId: pack.packId,
          version: pack.version,
          status: pack.status,
          feePosture: pack.feePosture[matter.controllerType],
          authoredByDisplayName: pack.authoredBy?.displayName ?? null,
          reviewedByDisplayName: pack.reviewedBy?.displayName ?? null,
          reviewedOn: pack.reviewedOn,
          reviewDueOn: pack.reviewDueOn,
          openQuestions: pack.openQuestions,
        }}
        renderLineControls={(assessmentLineId) => {
          const line = assessment.lines.find((candidate) => candidate.id === assessmentLineId);
          // Once a line is decided, no further control is offered — this
          // demo has no "undo a disposition" control (out of this plan's
          // scope), matching Annex A's own resolved-line summary treatment.
          if (!line || line.disposition !== "PENDING") return null;
          return (
            <DispositionControls
              assessmentLineId={assessmentLineId}
              verdict={line.verdict}
              currency={matter.currency}
              matterId={matter.id}
            />
          );
        }}
        bulkAcceptBar={<BulkAcceptBar assessmentId={assessment.id} eligibleLineIds={eligibleLineIds} />}
        signOffPanel={signOffPanel}
        flatFeeChoice={
          <FlatFeeChoice
            assessmentId={assessment.id}
            flatFeeComparison={assessment.totals.flatFeeComparison ?? null}
            flatFeeVerificationStatus={pack.flatFee?.verificationStatus ?? null}
            currency={matter.currency}
            currentChoice={assessment.feeChoice ?? null}
          />
        }
        recomputeBanner={
          showRecomputeBanner ? (
            <RecomputeConfirm
              assessmentId={assessment.id}
              pinnedVersion={assessment.rulePackVersion}
              newVersion={currentPack.version}
            />
          ) : null
        }
      />
    </main>
  );
}
