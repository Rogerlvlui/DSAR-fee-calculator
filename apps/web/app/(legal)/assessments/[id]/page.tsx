// apps/web/app/(legal)/assessments/[id]/page.tsx
//
// An async server component: await the route params, resolve the actor,
// call getAssessmentForLegalReview, load the untransformed pack with
// loadDemoPack(), and pass plain props down to the status strip and the
// assessment view. The page fetches and authorises; it renders nothing
// itself beyond composition. The pack status it hands the strip comes from
// the untransformed load result — never the engine-invocation boundary's
// coerced copy.

import { getCurrentActor } from "../../../../src/server/current-actor.ts";
import { getAssessmentForLegalReview } from "../../../../src/server/data/assessments.ts";
import { loadDemoPack } from "../../../../src/server/engine-invocation.ts";
import { memoryMatterRepository } from "../../../../src/server/repositories/memory/matter-repository.ts";
import { NotFoundError } from "../../../../src/server/errors.ts";
import { StatusStrip } from "../../../../src/ui/chrome/status-strip.tsx";
import { AssessmentView } from "../../../../src/ui/review/assessment-view.tsx";

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
      <AssessmentView assessment={assessment} expenseLines={expenseLines} currency={matter.currency} />
    </main>
  );
}
