// apps/web/app/legal/queue/page.tsx
//
// The legal worklist, at NAV-01's own literal path (06-04; moved here from
// apps/web/app/(legal)/assessments/page.tsx). Widened by 06-06 into what
// NAV-01 actually asks for: matters in LEGAL_REVIEW and INFO_REQUEST (not
// only the two statuses the old /assessments page ever queried for),
// sortable by advisory deadline or age via a URL-search-param toggle — a
// server component reading `searchParams` is this codebase's own simplest,
// no-new-client-state way to make a toggle reachable without JavaScript,
// consistent with every other page in this app being server-rendered by
// default. No SLA colour or escalation styling anywhere (NAV-01's own
// explicit NS-5 bound) — the row ORDER itself carries the urgency signal.
//
// CR-01 fix (03.1-REVIEW.md): before this page existed, "Open an
// assessment, as Legal" on the landing page linked to a URL with no route
// behind it, and nothing anywhere in the app surfaced an assessment id to a
// presenter: there was no working path from HR intake to legal review. A
// worklist a lawyer scans and clicks into is also the architecturally
// honest shape — in the real product Legal is never handed an id by HR.
//
// Reads through getCurrentActor() + listReviewableMatters(), the same
// role-checked-DAL pattern every other page/route in this phase uses —
// this page's first cut called the memory repositories directly with no
// role check at all (security audit finding UNREG-1); fixed post-plan.
// 06-06 widens the SAME already-correct call; it introduces no second,
// ungated repository read anywhere in this file.

import type { Matter } from "@dsar/schemas/matter";
import type { MatterStatus } from "@dsar/schemas/matter-status";
import { getCurrentActor } from "../../../src/server/current-actor.ts";
import { listReviewableMatters } from "../../../src/server/data/matters.ts";
import { buildJurisdictionPackViews } from "../../../src/server/jurisdiction-packs.ts";
import { computeAdvisoryDeadline, ADVISORY_QUALIFIER, type AdvisoryDeadlineView } from "../../../src/domain/advisory-deadline.ts";
import { sortQueueRows, type QueueSortMode } from "../../../src/domain/queue-sort.ts";

// UI-SPEC's exact three-way row status mapping — LEGAL_REVIEW and
// INFO_REQUEST each get their own label; SIGNED_OFF and CLOSED share one
// ("Signed off" — a closed matter is still a signed one, same treatment
// apps/web/app/hr/matters/[id]/page.tsx already gives HR's own result view).
const ROW_STATUS_LABEL: Partial<Record<MatterStatus, string>> = {
  LEGAL_REVIEW: "Awaiting review",
  INFO_REQUEST: "Awaiting HR reply",
  SIGNED_OFF: "Signed off",
  CLOSED: "Signed off",
};

function rowStatusLabel(status: Matter["status"]): string {
  return ROW_STATUS_LABEL[status] ?? status;
}

function resolveSortMode(sortParam: string | undefined): QueueSortMode {
  return sortParam === "oldest" ? "OLDEST_FIRST" : "DEADLINE_SOONEST";
}

interface QueueRow {
  matter: Matter;
  assessmentId: string;
  requestReceivedOn: string;
  advisoryDeadline: AdvisoryDeadlineView | null;
}

export default async function LegalQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const mode = resolveSortMode(sort);

  const actor = await getCurrentActor();
  const entries = await listReviewableMatters(actor);

  const now = new Date().toISOString();
  const packsByJurisdiction = buildJurisdictionPackViews(now);

  const rows: QueueRow[] = entries.map(({ matter, assessmentId }) => {
    const jurisdictionPack = packsByJurisdiction[matter.jurisdictionCode];
    const advisoryDeadline = jurisdictionPack.constraints
      ? computeAdvisoryDeadline(matter, jurisdictionPack.constraints, now)
      : null;
    return { matter, assessmentId, requestReceivedOn: matter.requestReceivedOn, advisoryDeadline };
  });

  const sortedRows = sortQueueRows(rows, mode);

  return (
    <main>
      <h1 className="screen">Legal queue</h1>

      <nav data-testid="queue-sort-toggle" aria-label="Sort">
        <span>Sort: </span>
        <a
          href="?sort=deadline"
          aria-current={mode === "DEADLINE_SOONEST" ? "true" : undefined}
          className={mode === "DEADLINE_SOONEST" ? "underline" : undefined}
        >
          Deadline soonest
        </a>{" "}
        <a
          href="?sort=oldest"
          aria-current={mode === "OLDEST_FIRST" ? "true" : undefined}
          className={mode === "OLDEST_FIRST" ? "underline" : undefined}
        >
          Oldest first
        </a>
      </nav>

      {sortedRows.length === 0 ? (
        <p data-testid="assessments-empty">
          No claims are waiting on Legal right now. HR submits a claim, and it appears here.
        </p>
      ) : (
        <ul data-testid="assessments-list">
          {sortedRows.map(({ matter, assessmentId, advisoryDeadline }) => (
            <li key={assessmentId}>
              <a href={`/legal/assessments/${assessmentId}`}>
                {matter.reference} — {rowStatusLabel(matter.status)}
              </a>
              {advisoryDeadline ? (
                <div data-testid="advisory-deadline">
                  {advisoryDeadline.basis === "FEE_NOTIFICATION" ? "Fee notification due " : "Response due "}
                  {advisoryDeadline.dueDateIso} — {advisoryDeadline.daysRemaining} days. <b>{ADVISORY_QUALIFIER}</b>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
