// apps/web/app/(legal)/assessments/[id]/page.tsx
//
// An async server component: await the route params, resolve the actor,
// call getAssessmentForLegalReview, load the untransformed pack with
// loadDemoPack(), build the review view (apps/web/src/server/review-view.ts)
// and pass plain props down to the status strip and the assessment view.
// The page fetches and authorises; it renders nothing itself beyond
// composition. The pack status it hands both the strip and the pack rail
// comes from the untransformed load result — never the engine-invocation
// boundary's coerced copy.

import { getCurrentActor } from "../../../../src/server/current-actor.ts";
import { getAssessmentForLegalReview, listBulkAcceptableLineIds } from "../../../../src/server/data/assessments.ts";
import { loadDemoPack } from "../../../../src/server/engine-invocation.ts";
import { buildReviewView } from "../../../../src/server/review-view.ts";
import { memoryMatterRepository } from "../../../../src/server/repositories/memory/matter-repository.ts";
import { NotFoundError } from "../../../../src/server/errors.ts";
import { StatusStrip } from "../../../../src/ui/chrome/status-strip.tsx";
import { AssessmentView } from "../../../../src/ui/review/assessment-view.tsx";
import { DispositionControls } from "../../../../src/ui/review/disposition-controls.tsx";
import { BulkAcceptBar } from "../../../../src/ui/review/bulk-accept-bar.tsx";

export default async function LegalAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getCurrentActor();
  const assessment = await getAssessmentForLegalReview(actor, id);
  const matter = await memoryMatterRepository.getMatter(assessment.matterId);
  if (!matter) {
    throw new NotFoundError(`No matter found for assessment '${id}'`);
  }
  const expenseLines = await memoryMatterRepository.listExpenseLines(assessment.matterId);
  const pack = loadDemoPack();
  const reviewView = buildReviewView(assessment, matter, expenseLines);
  const eligibleLineIds = listBulkAcceptableLineIds(assessment);

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
            <DispositionControls assessmentLineId={assessmentLineId} verdict={line.verdict} currency={matter.currency} />
          );
        }}
        bulkAcceptBar={<BulkAcceptBar assessmentId={assessment.id} eligibleLineIds={eligibleLineIds} />}
      />
    </main>
  );
}
