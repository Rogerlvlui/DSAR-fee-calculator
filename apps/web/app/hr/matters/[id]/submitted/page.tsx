// apps/web/app/hr/matters/[id]/submitted/page.tsx
//
// The HR confirmation screen shown immediately after submit: the matter
// reference and PRD §10.2's closing sentence, verbatim. That sentence is
// the whole point of this screen — without it HR reads the silence as a
// bug and starts asking Legal for the draft (PRD §10.2).
//
// Added post-plan (05-REVIEW-ADDENDUM.md CR-01, independent code review
// finding): this page originally read any matter id straight off the
// repository with no actor resolution and no requireRole() call anywhere
// — the same UNREG-1/WR-02 bug class already found and fixed twice before
// in this project (Phase 3.1, Phase 4). It now resolves the actor and
// routes through getHrMatterStatus(), the same requireRole()-gated,
// NotFoundError-throwing read the sibling matters/[id]/page.tsx already
// uses, closing the one remaining unregistered read in this phase.

import { getCurrentActor } from "../../../../../src/server/current-actor.ts";
import { getHrMatterStatus } from "../../../../../src/server/data/matters.ts";
import { buildJurisdictionPackViews } from "../../../../../src/server/jurisdiction-packs.ts";
import { StatusStrip } from "../../../../../src/ui/chrome/status-strip.tsx";
import { humanizePackDisplayStatus } from "../../../../../src/domain/pack-display-status.ts";
import { RoleSwitchButton } from "../../../../../src/ui/chrome/app-header.tsx";
import { DEMO_ROLE_COOKIE } from "../../../../../src/server/data/auth.ts";

export default async function MatterSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  const { matter } = await getHrMatterStatus(actor, id);
  const now = new Date().toISOString();
  const jurisdictionPack = buildJurisdictionPackViews(now)[matter.jurisdictionCode];

  return (
    <main className="submission-page">
      <h1 className="screen">Claim submitted — {matter.reference}</h1>
      <StatusStrip
        matterReference={matter.reference}
        jurisdictionName={jurisdictionPack.jurisdictionName}
        rulePackId={jurisdictionPack.packId ?? "—"}
        rulePackVersion={jurisdictionPack.version ?? "—"}
        packStatus={humanizePackDisplayStatus(jurisdictionPack.displayStatus)}
        authoredByDisplayName={jurisdictionPack.authoredByDisplayName}
        reviewedByDisplayName={jurisdictionPack.reviewedByDisplayName}
        reviewedOn={jurisdictionPack.reviewedOn}
        daysUntilReviewDue={jurisdictionPack.daysUntilReviewDue ?? 9999}
      />
      <section className="card submission-card">
        <h2>In Legal&apos;s review queue</h2>
        <p data-testid="submitted-confirmation">Your claim is in Legal&apos;s review queue. HR sees the assessed fee after lawyer sign-off; no draft figure is shown here.</p>
        <div className="submission-actions">
          <a href={`/hr/matters/${id}`} className="btn btn-secondary">View HR status</a>
          <RoleSwitchButton cookieName={DEMO_ROLE_COOKIE} role="LEGAL_REVIEWER" href="/legal/queue" className="btn btn-primary">Demo: switch to Legal queue</RoleSwitchButton>
        </div>
      </section>
    </main>
  );
}
