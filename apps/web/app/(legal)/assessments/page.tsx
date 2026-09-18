// apps/web/app/(legal)/assessments/page.tsx
//
// The legal worklist — CR-01 fix (03.1-REVIEW.md). Before this page existed,
// "Open an assessment, as Legal" on the landing page linked to a URL with no
// route behind it, and nothing anywhere in the app surfaced an assessment id
// to a presenter: there was no working path from HR intake to legal review.
// A worklist a lawyer scans and clicks into is also the architecturally
// honest shape — in the real product Legal is never handed an id by HR.

import { memoryMatterRepository } from "../../../src/server/repositories/memory/matter-repository.ts";
import { memoryAssessmentRepository } from "../../../src/server/repositories/memory/assessment-repository.ts";

export default async function AssessmentsListPage() {
  const matters = await memoryMatterRepository.listMatters();
  const reviewable = matters.filter(
    (matter) => matter.status === "LEGAL_REVIEW" || matter.status === "SIGNED_OFF"
  );

  const rows = await Promise.all(
    reviewable.map(async (matter) => {
      const assessment = await memoryAssessmentRepository.getAssessmentByMatterId(matter.id);
      return assessment ? { matter, assessment } : null;
    })
  );
  const entries = rows.filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <main>
      <h1 className="screen">Assessments</h1>
      {entries.length === 0 ? (
        <p data-testid="assessments-empty">
          No claims are waiting on Legal right now. HR submits a claim, and it appears here.
        </p>
      ) : (
        <ul data-testid="assessments-list">
          {entries.map(({ matter, assessment }) => (
            <li key={assessment.id}>
              <a href={`/legal/assessments/${assessment.id}`}>
                {matter.reference} — {matter.status === "SIGNED_OFF" ? "Signed off" : "Awaiting review"}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
