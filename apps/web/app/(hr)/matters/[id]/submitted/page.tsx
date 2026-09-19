// apps/web/app/(hr)/matters/[id]/submitted/page.tsx
//
// The HR confirmation screen shown immediately after submit: the matter
// reference and PRD §10.2's closing sentence, verbatim. That sentence is
// the whole point of this screen — without it HR reads the silence as a
// bug and starts asking Legal for the draft (PRD §10.2).

import { memoryMatterRepository } from "../../../../../src/server/repositories/memory/matter-repository.ts";
import { NotFoundError } from "../../../../../src/server/errors.ts";
import { buildJurisdictionPackViews } from "../../../../../src/server/jurisdiction-packs.ts";
import { StatusStrip } from "../../../../../src/ui/chrome/status-strip.tsx";

export default async function MatterSubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matter = await memoryMatterRepository.getMatter(id);
  if (!matter) {
    throw new NotFoundError(`No matter with id '${id}'`);
  }
  const now = new Date().toISOString();
  const jurisdictionPack = buildJurisdictionPackViews(now)[matter.jurisdictionCode];

  return (
    <main>
      <h1 className="screen">Claim submitted — {matter.reference}</h1>
      <StatusStrip
        matterReference={matter.reference}
        jurisdictionName={jurisdictionPack.jurisdictionName}
        rulePackId={jurisdictionPack.packId ?? "—"}
        rulePackVersion={jurisdictionPack.version ?? "—"}
        packStatus={jurisdictionPack.displayStatus === "NO_USABLE_PACK" ? "—" : jurisdictionPack.displayStatus}
        authoredByDisplayName={jurisdictionPack.authoredByDisplayName}
        reviewedByDisplayName={jurisdictionPack.reviewedByDisplayName}
        reviewedOn={jurisdictionPack.reviewedOn}
        daysUntilReviewDue={jurisdictionPack.daysUntilReviewDue ?? 9999}
      />
      <p data-testid="submitted-confirmation">
        Legal has been notified. You&apos;ll see the assessed fee once a lawyer has reviewed and
        signed it off. You will not see a draft figure before then.
      </p>
    </main>
  );
}
