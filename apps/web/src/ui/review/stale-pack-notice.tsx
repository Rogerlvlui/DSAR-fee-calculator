// apps/web/src/ui/review/stale-pack-notice.tsx
//
// AC-39's in-flight-review half — PRD §9.3/§10.7 name this a full-width
// RED notice, deliberately distinct from 06-UI-SPEC.md's amber recompute
// banner (apps/web/src/ui/review/recompute-confirm.tsx) and from
// PackRail's own amber "Pack status" cell: `--stop`/`--stop-wash`, never
// `--warn`/`--warn-wash`. The gating predicate
// (shouldRenderStalePackNotice, apps/web/src/domain/stale-pack-notice.ts)
// lives outside this module entirely, for the same reason
// recompute-banner.ts's own header records: a function called from the
// Server Component page cannot live in a "use client" module.
//
// This banner has no interaction at all — no expand, no dismiss, no fetch
// — so unlike recompute-confirm.tsx/signoff-panel.tsx it needs no
// useState, no useRouter, and therefore no "use client" directive. It is
// authored as a plain, server-renderable component; a later change that
// adds interaction should add the directive then, not preemptively here.

export const STALE_PACK_NOTICE_HEADING = "Rule pack past review date";

export interface StalePackNoticeBodyInput {
  packId: string;
  version: string;
  reviewDueOn: string;
}

// 07-UI-SPEC.md's Copywriting Contract, verbatim. The only variable
// content is the pack id, the pack version and the review-due date — all
// bounded, machine-generated identifiers, never free text, so the sentence
// simply wraps if it ever runs long rather than needing truncation.
export function stalePackNoticeBody({ packId, version, reviewDueOn }: StalePackNoticeBodyInput): string {
  return (
    `${packId} ${version} was due for review on ${reviewDueOn}. You may still review and sign off this ` +
    `assessment. Your sign-off attestation below will include an extra line confirming you have checked the ` +
    `current position yourself.`
  );
}

export interface StalePackNoticeViewProps {
  packId: string;
  version: string;
  reviewDueOn: string;
}

/** Pure, props-driven — this is what stale-pack-notice.test.tsx renders
 * directly. The heading words are the signal (never colour alone, per
 * WCAG 2.1 AA and PROJECT.md's no-verdict-by-colour constraint) — the
 * destructive `--stop`/`--stop-wash` treatment is additional, not
 * load-bearing on its own. */
export function StalePackNoticeView({ packId, version, reviewDueOn }: StalePackNoticeViewProps) {
  return (
    <div data-testid="stale-pack-notice" className="text-stop bg-stop-wash border-stop">
      <p data-testid="stale-pack-notice-heading">{STALE_PACK_NOTICE_HEADING}</p>
      <p data-testid="stale-pack-notice-body">{stalePackNoticeBody({ packId, version, reviewDueOn })}</p>
    </div>
  );
}

export interface StalePackNoticeProps {
  packId: string;
  version: string;
  reviewDueOn: string;
}

/** Thin wrapper — no state of its own, exists only so the caller
 * (apps/web/app/legal/assessments/[id]/page.tsx) composes a named
 * component into the assessment-view slot exactly the way every other
 * banner does, matching RecomputeConfirm/SignOffPanel's own shape. */
export function StalePackNotice({ packId, version, reviewDueOn }: StalePackNoticeProps) {
  return <StalePackNoticeView packId={packId} version={version} reviewDueOn={reviewDueOn} />;
}
