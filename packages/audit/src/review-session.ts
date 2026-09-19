// packages/audit/src/review-session.ts
//
// The ephemeral "first opened" record (AUDIT-03). This is deliberately
// throwaway state, not a persisted domain entity — the same
// persistence-risk Phase 3.1 already accepted project-wide for its whole
// store. Nobody should later mistake this for something a Postgres
// migration was supposed to cover.
//
// The instant is always supplied by the caller rather than read from a
// clock inside this module, so every test is deterministic and the
// STATE-03 recompute path can reset the origin explicitly. Anchored to
// globalThis behind its own uniquely named property, for the same
// Fast-Refresh-survival reason apps/web/src/server/repositories/memory/store.ts's
// demoStore is.

declare global {
  // eslint-disable-next-line no-var
  var __dsarReviewSessionOpenedAt: Map<string, string> | undefined;
}

const openedAtByAssessmentId: Map<string, string> =
  globalThis.__dsarReviewSessionOpenedAt ?? (globalThis.__dsarReviewSessionOpenedAt = new Map());

// Idempotent — keeps the earliest recorded instant. The first call in a
// review pass wins; a later call for the same assessment is a no-op.
export function recordAssessmentOpened(assessmentId: string, at: string): void {
  if (!openedAtByAssessmentId.has(assessmentId)) {
    openedAtByAssessmentId.set(assessmentId, at);
  }
}

// Zero, not absent, when no origin has been recorded for this assessment.
// A zero here means the action was taken without the assessment ever
// having been opened through the review screen in this process — itself
// the automation-bias signal AUDIT-03 exists to surface, not a missing
// measurement. An absent figure would be indistinguishable from a writer
// bug, which is why memory/audit-event-writer.ts refuses it outright for
// the two event types that require it.
export function elapsedReviewMs(assessmentId: string, at: string): number {
  const openedAt = openedAtByAssessmentId.get(assessmentId);
  if (!openedAt) return 0;
  const elapsed = new Date(at).getTime() - new Date(openedAt).getTime();
  return Math.max(0, Math.trunc(elapsed));
}

// STATE-03's in-place recompute (LEGAL_REVIEW -> COMPUTING -> LEGAL_REVIEW)
// clears every disposition — this must also clear the review-open origin,
// so the next open establishes a fresh one for the new review pass
// (04-RESEARCH.md Pitfall 3). Called from the same code path that performs
// the recompute mutation (plan 04-04).
export function clearAssessmentOpened(assessmentId: string): void {
  openedAtByAssessmentId.delete(assessmentId);
}
