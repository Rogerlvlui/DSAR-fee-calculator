// apps/web/app/hr/matters/page.tsx
//
// NAV-02 — the in-app substitute NS-3's ban on outbound email requires: a
// preparer's own worklist. Mirrors the legal queue page's own exact shape
// (apps/web/app/legal/queue/page.tsx): resolve the actor, call the
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
    <main className="worklist-page">
      <div className="worklist-heading"><div><h1 className="screen">Your matters</h1><p className="lede">Track claims you have prepared.</p></div><a href="/hr/matters/new" className="btn btn-primary">New fee claim</a></div>
      {matters.length === 0 ? (
        <p data-testid="matters-empty" className="card worklist-empty">
          No matters yet. <a href="/hr/matters/new">Create a fee claim</a> to get started.
        </p>
      ) : (
        <ul data-testid="matters-list" className="worklist">
          {matters.map((matter) => {
            const jurisdictionPack = packsByJurisdiction[matter.jurisdictionCode];
            const advisoryDeadline = jurisdictionPack.constraints
              ? computeAdvisoryDeadline(matter, jurisdictionPack.constraints, now)
              : null;
            return (
              <li key={matter.id} className="worklist-item">
                <a href={`/hr/matters/${matter.id}`} className="worklist-link">
                  <strong>{matter.reference}</strong><span className="worklist-status">{matterStatusLabelForHr(matter.status)}</span>
                </a>
                {advisoryDeadline ? (
                  <div data-testid="advisory-deadline" className="worklist-deadline">
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
