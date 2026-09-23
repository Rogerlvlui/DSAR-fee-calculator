// apps/web/src/ui/chrome/status-strip.tsx
//
// A props-driven presentational component rendering the strip cells: matter
// reference, jurisdiction, rule pack id and version, the new Pack status
// cell, and authored/reviewed by. The Pack status cell takes the pack's
// REAL, untransformed status as a prop — it must never receive the
// engine-invocation boundary's coerced copy — and always renders in the
// warn treatment, never the ok/green one, whatever the value (this is a
// hard constraint, not a style choice: success criterion 5). Imports
// nothing from the app's server-side module tree.

export interface StatusStripProps {
  matterReference: string;
  jurisdictionName: string;
  rulePackId: string;
  rulePackVersion: string;
  /** The pack's real, uncoerced status (e.g. "DRAFT") — never the
   * engine-invocation boundary's in-memory ACTIVE copy. */
  packStatus: string;
  authoredByDisplayName: string | null;
  reviewedByDisplayName: string | null;
  /** The pack's own `reviewedOn` date, verbatim, or `null` when never reviewed. */
  reviewedOn: string | null;
  /** `@dsar/rulepacks/stale`'s `daysUntilReviewDue` — the same `<= 30`
   * threshold `packages/engine/src/matter-flags.ts`'s `STALE_PACK_WARNING`
   * already uses, so this component reuses that boundary rather than
   * inventing a second one. Not subject to the "Pack status always warns"
   * constraint below — it makes no claim about authoring completeness, only
   * calendar timing. */
  daysUntilReviewDue: number;
}

const REVIEW_DUE_SOON_THRESHOLD_DAYS = 30;

type ReviewDueTone = "current" | "due-soon" | "stale";

function deriveReviewDueTone(daysUntilReviewDue: number): ReviewDueTone {
  if (daysUntilReviewDue < 0) return "stale";
  if (daysUntilReviewDue <= REVIEW_DUE_SOON_THRESHOLD_DAYS) return "due-soon";
  return "current";
}

function formatReviewDueLabel(daysUntilReviewDue: number): string {
  const tone = deriveReviewDueTone(daysUntilReviewDue);
  if (tone === "stale") return "Stale — past its review date";
  if (tone === "due-soon") return `Due in ${daysUntilReviewDue} days`;
  return "Current";
}

// UI-SPEC Copywriting Contract, verbatim — required by this phase's
// demo-specific hard constraint (the pack's real status must never be
// mistaken for the coerced one the engine computes against).
export const PACK_STATUS_DISCLOSURE =
  "Real status. The engine computes against an in-memory copy coerced to Active for this demo only.";

function formatAuthoredReviewedBy(
  authoredByDisplayName: string | null,
  reviewedByDisplayName: string | null
): string {
  if (authoredByDisplayName && reviewedByDisplayName) {
    return `${authoredByDisplayName} / ${reviewedByDisplayName}`;
  }
  return authoredByDisplayName ?? reviewedByDisplayName ?? "Not yet authored";
}

export function StatusStrip({
  matterReference,
  jurisdictionName,
  rulePackId,
  rulePackVersion,
  packStatus,
  authoredByDisplayName,
  reviewedByDisplayName,
  reviewedOn,
  daysUntilReviewDue,
}: StatusStripProps) {
  return (
    <div role="group" aria-label="Rule pack status" data-testid="status-strip" className="status-strip">
      <div>
        <dt>Matter reference</dt>
        <dd>{matterReference}</dd>
      </div>
      <div>
        <dt>Jurisdiction</dt>
        <dd>{jurisdictionName}</dd>
      </div>
      <div>
        <dt>Rule pack</dt>
        <dd className="font-mono">
          {rulePackId} {rulePackVersion}
        </dd>
      </div>
      <div data-testid="pack-status-cell">
        <dt>Pack status</dt>
        <dd className="text-warn">{packStatus}</dd>
        <p className="text-ink-3">{PACK_STATUS_DISCLOSURE}</p>
      </div>
      <div>
        <dt>Authored / reviewed by</dt>
        <dd>{formatAuthoredReviewedBy(authoredByDisplayName, reviewedByDisplayName)}</dd>
      </div>
      <div>
        <dt>Reviewed</dt>
        <dd>{reviewedOn ?? "Not yet reviewed"}</dd>
      </div>
      <div>
        <dt>Review due</dt>
        <dd>{formatReviewDueLabel(daysUntilReviewDue)}</dd>
      </div>
    </div>
  );
}
