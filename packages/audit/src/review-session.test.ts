// packages/audit/src/review-session.test.ts
//
// Tagged REVIEW-SESSION. Proves the idempotent first-opened record, the
// zero-not-absent elapsed reading for a never-opened assessment, and the
// clear-then-reset origin semantics AUDIT-03 and STATE-03's recompute path
// depend on.

import { describe, expect, it } from "vitest";
import { clearAssessmentOpened, elapsedReviewMs, recordAssessmentOpened } from "./review-session.ts";

describe("REVIEW-SESSION — the ephemeral first-opened record", () => {
  it("REVIEW-SESSION: recording an assessment as opened twice keeps the first timestamp; the elapsed figure is measured from it", () => {
    const assessmentId = "assessment-idempotent";
    recordAssessmentOpened(assessmentId, "2026-09-19T10:00:00.000Z");
    recordAssessmentOpened(assessmentId, "2026-09-19T10:05:00.000Z");

    expect(elapsedReviewMs(assessmentId, "2026-09-19T10:10:00.000Z")).toBe(10 * 60 * 1000);
  });

  it("REVIEW-SESSION: the elapsed figure for an assessment never recorded as opened is exactly zero, and an integer", () => {
    const elapsed = elapsedReviewMs("assessment-never-opened", "2026-09-19T10:00:00.000Z");
    expect(elapsed).toBe(0);
    expect(Number.isInteger(elapsed)).toBe(true);
  });

  it("REVIEW-SESSION: clearing an assessment's open record makes the next recording establish a new origin", () => {
    const assessmentId = "assessment-reset";
    recordAssessmentOpened(assessmentId, "2026-09-19T09:00:00.000Z");
    clearAssessmentOpened(assessmentId);
    recordAssessmentOpened(assessmentId, "2026-09-19T11:00:00.000Z");

    expect(elapsedReviewMs(assessmentId, "2026-09-19T11:02:00.000Z")).toBe(2 * 60 * 1000);
  });
});
