// apps/web/app/(hr)/matters/page.tsx
//
// NAV-02 — the in-app substitute NS-3's ban on outbound email requires: a
// preparer's own worklist. Mirrors AssessmentsListPage's exact shape
// (apps/web/app/(legal)/assessments/page.tsx): resolve the actor, call the
// role-checked read, render an empty state or a <ul><li> per matter. Reads
// no Assessment anywhere — this page's leak boundary (AC-02/AC-04) is that
// HR sees only a collapsed status label, never which of
// COMPUTING/LEGAL_REVIEW/INFO_REQUEST a matter is actually in.

import { getCurrentActor } from "../../../src/server/current-actor.ts";
import { listMattersForPreparer } from "../../../src/server/data/matters.ts";
import { buildJurisdictionPackViews } from "../../../src/server/jurisdiction-packs.ts";
import { matterStatusLabelForHr } from "../../../src/domain/hr-matter-status-label.ts";
import { computeAdvisoryDeadline, ADVISORY_QUALIFIER } from "../../../src/domain/advisory-deadline.ts";

export default async function HrMattersListPage() {
  const actor = await getCurrentActor();
  const matters = await listMattersForPreparer(actor);
  const now = new Date().toISOString();
  const packsByJurisdiction = buildJurisdictionPackViews(now);

  return (
    <main>
      <h1 className="screen">Your matters</h1>
      {matters.length === 0 ? (
        <p data-testid="matters-empty">
          No matters yet. <a href="/matters/new">Create a fee claim</a> to get started.
        </p>
      ) : (
        <ul data-testid="matters-list">
          {matters.map((matter) => {
            const jurisdictionPack = packsByJurisdiction[matter.jurisdictionCode];
            const advisoryDeadline = jurisdictionPack.constraints
              ? computeAdvisoryDeadline(matter, jurisdictionPack.constraints, now)
              : null;
            return (
              <li key={matter.id}>
                <a href={`/matters/${matter.id}`}>
                  {matter.reference} — {matterStatusLabelForHr(matter.status)}
                </a>
                {advisoryDeadline ? (
                  <div data-testid="advisory-deadline">
                    {advisoryDeadline.basis === "FEE_NOTIFICATION" ? "Fee notification due " : "Response due "}
                    {advisoryDeadline.dueDateIso} — {advisoryDeadline.daysRemaining} days. <b>{ADVISORY_QUALIFIER}</b>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
