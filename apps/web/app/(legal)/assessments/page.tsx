// apps/web/app/(legal)/assessments/page.tsx
//
// The legal worklist — CR-01 fix (03.1-REVIEW.md). Before this page existed,
// "Open an assessment, as Legal" on the landing page linked to a URL with no
// route behind it, and nothing anywhere in the app surfaced an assessment id
// to a presenter: there was no working path from HR intake to legal review.
// A worklist a lawyer scans and clicks into is also the architecturally
// honest shape — in the real product Legal is never handed an id by HR.
//
// Reads through getCurrentActor() + listReviewableMatters(), the same
// role-checked-DAL pattern every other page/route in this phase uses —
// this page's first cut called the memory repositories directly with no
// role check at all (security audit finding UNREG-1); fixed post-plan.

import { getCurrentActor } from "../../../src/server/current-actor.ts";
import { listReviewableMatters } from "../../../src/server/data/matters.ts";

export default async function AssessmentsListPage() {
  const actor = await getCurrentActor();
  const entries = await listReviewableMatters(actor);

  return (
    <main>
      <h1 className="screen">Assessments</h1>
      {entries.length === 0 ? (
        <p data-testid="assessments-empty">
          No claims are waiting on Legal right now. HR submits a claim, and it appears here.
        </p>
      ) : (
        <ul data-testid="assessments-list">
          {entries.map(({ matter, assessmentId }) => (
            <li key={assessmentId}>
              <a href={`/assessments/${assessmentId}`}>
                {matter.reference} — {matter.status === "SIGNED_OFF" ? "Signed off" : "Awaiting review"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
