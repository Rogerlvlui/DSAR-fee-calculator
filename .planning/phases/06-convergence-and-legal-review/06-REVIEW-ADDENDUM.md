---
phase: 06-convergence-and-legal-review
reviewed: 2026-09-20T00:00:00Z
depth: independent-followup
status: all_resolved
findings:
  critical: 1
  warning: 2
  info: 2
  docs: 1
  total: 6
  resolved: 6
  open: 0
---

# Phase 06: Review Addendum — Independent Follow-up Findings

**Reviewed:** 2026-09-20
**Reviewer:** Two independent subagents (a fresh code-reviewer and a fresh security-auditor, neither of which had written the code), dispatched after Phase 6 execution to check whether the recurring authorization-gap bug class that hit Phases 3.1, 4, and 5 recurred a fourth time.

**Do not edit `06-01-SUMMARY.md` through `06-09-SUMMARY.md`** — those remain the historical record of what was executed. This addendum documents what the independent pass found afterward, and what was fixed.

## Why this addendum exists

Good news first: the independent security-auditor confirmed the authorization-gap bug class that recurred across Phases 3.1 (UNREG-1), 4 (WR-02), and 5 (CR-01) did **not** recur in Phase 6 — every genuinely security-relevant read and write goes through a `requireRole()`-gated data-layer function. The security audit closed at SECURED (20/20, 0 open).

The independent code-reviewer, however, found a real Critical money-correctness bug — the kind of defect this project's entire architecture exists to prevent (PRD §0: "the LLM never does arithmetic... the engine flags rather than decides"; here the bug is more precisely that a lawyer's own explicit decision was silently discarded) — plus two Warnings and three minor items (a smaller instance of the same "page bypasses the role-gated data layer" pattern, dead code with a misleading comment, and stale doc-comment paths).

## Findings and Fixes

### CR-01 (Critical) — the flat-fee-vs-itemised choice had zero effect on the charged amount

**Found by:** independent code-reviewer.

**Issue:** `computeFinalAmount` (`apps/web/src/domain/review-tallies.ts`) summed each assessment line's amount unconditionally and never read `assessment.feeChoice`. A lawyer could select "Flat fee: HK$100" (REVIEW-11's choice, persisted via `setFeeChoice` and audited as `FEE_CHOICE_SET`), sign off, and `finalAmount` — the figure that reaches HR and the notice draft — would still be the full itemised sum, completely ignoring the choice actually made. This directly undermined the project's core defensibility claim: the engine (and the lawyer's own recorded decision) must be what determines the figure, never a silently-dropped input.

**Fix:** `computeFinalAmount` now takes the assessment's `feeChoice` and `flatFeeComparison` as optional parameters and branches: when `feeChoice === "FLAT"` and a `flatFeeComparison` exists, the final amount is the flat fee figure; otherwise (no choice, or `"ITEMISED"`) it is the unchanged per-line sum. Both call sites that previously derived `finalAmount` independently — `signOff()` in `apps/web/src/server/data/assessments.ts` and the legal-review page's sign-off-panel preview (`apps/web/app/legal/assessments/[id]/page.tsx`) — now pass the same two fields through, so neither can drift from the other. `apps/web/src/ui/review/totals-rail.tsx`'s pre-sign-off headline (which previously fell back to `draftBaseline`, the same bug in a different spot) now applies the identical branch via a new `previewHeadlineAmount` helper.

**Regression test:** `tests/routes/fee-choice.test.ts` (new case, CR-01) — builds a real HK matter through the real engine, dispositions every line, chooses `FLAT`, signs off, and asserts `finalAmount` equals the flat fee (10000) rather than the itemised sum (20000) — both figures deliberately made to differ so the test cannot pass by coincidence.

**Commit:** `cf97cd8`

---

### WR-01 (Warning) — `POST /api/assessments/{id}/fee-choice` accepted an unvalidated `choice` value

**Found by:** independent code-reviewer.

**Issue:** The route handler type-asserted the request body (`as FeeChoiceBody`) instead of parsing it through `FeeChoiceSchema` (`z.enum(["ITEMISED", "FLAT"])`, `packages/schemas/src/assessment.ts`). Any other string fell through `setFeeChoice`'s `choice === "FLAT"` check unblocked and was written straight into the audited `feeChoice` enum field.

**Fix:** The body is now parsed through a small `FeeChoiceRequestSchema` (`z.strictObject({ choice: FeeChoiceSchema })`) before it reaches `setFeeChoice`. A malformed value throws a `ZodError`, which `errorToResponse` already maps to 400 — no new error-handling path needed.

**Regression test:** `tests/routes/fee-choice.test.ts` (new case, WR-01) — a bogus `choice: "FREE"` value is refused with 400 and never reaches the repository (`stored?.feeChoice` stays `undefined`).

**Commit:** `62c868d`

---

### WR-02 (Warning) — the legal assessment page bypassed the role-gated data layer for two reads

**Found by:** independent code-reviewer.

**Issue:** `apps/web/app/legal/assessments/[id]/page.tsx` correctly called `getAssessmentForLegalReview` (role-gated) for the assessment itself, but then imported `memoryMatterRepository` directly and called `.getMatter(assessment.matterId)` / `.listExpenseLines(assessment.matterId)` with no role check on those two calls specifically. Not currently exploitable — `matterId` is only reachable after the assessment's own role gate has already passed — but it is exactly the "page imports a repository directly" shape that has caused real, exploitable bugs three times before in this project (Phase 3.1 UNREG-1, Phase 4 WR-02, Phase 5 CR-01).

**Fix:** Added `getMatterForLegalReview(actor, matterId)` and `getExpenseLinesForLegalReview(actor, matterId)` in `apps/web/src/server/data/matters.ts`, mirroring the existing `getExpenseLinesForHr` pattern (both `requireRole(actor, "LEGAL_REVIEWER")` as their first statement; `getMatterForLegalReview` throws `NotFoundError` rather than returning `null`). The page now calls these instead of the repository, and its own manual `if (!matter) throw ...` null-check was removed as redundant (the wrapper already throws).

**Regression test:** `tests/routes/access-control-review.test.ts` (new describe block) — proves both reads reject an `HR_PREPARER` actor, succeed for a `LEGAL_REVIEWER`, and that `getMatterForLegalReview` refuses (rather than silently returning something falsy) for a nonexistent matter id.

**Commit:** `5ee8350`

---

### IN-01 (Info, cheap fix bundled in) — `hasSufficientAndGenuineReason` was dead code with a misleading comment

**Found by:** independent code-reviewer.

**Issue:** `hasSufficientAndGenuineReason` (`apps/web/src/domain/disposition-actions.ts`) carried a doc comment claiming every reason-checking call site used it, but three call sites — `assertSufficientReason` (server-side, `apps/web/src/server/data/assessments.ts`), and the client-side submit gates in `disposition-controls.tsx` and `bulk-accept-bar.tsx` — each independently reimplemented the same length-and-stop-list logic inline instead.

**Fix:** Wired all three call sites to the shared function. `assertSufficientReason` now gates on `hasSufficientAndGenuineReason` first and only recomputes the specific failing sub-check when it needs to pick between its two distinct error messages (stock-phrase vs. too-short) — a behavior-preserving change, since every stop-list entry is already shorter than the length minimum on its own. The two client-side submit gates now call `hasSufficientAndGenuineReason` directly in place of the length-only check they used before, for the same reason: no behavior change today, but no longer two independent copies that could silently diverge if a longer stop-list phrase is ever added.

**Commit:** `8887b02`

---

### IN-02 (Info, cheap fix bundled in) — four stale doc-comment paths, plus a stale acceptance-criterion string

**Found by:** independent code-reviewer; the `DEMO-ONLY TRANSFORM` item by the independent security-auditor.

**Issue:** Four route-handler comments (`apps/web/app/api/assessments/[id]/route.ts`, `apps/web/app/api/assessment-lines/[id]/disposition/route.ts`, `apps/web/app/api/assessments/[id]/bulk-accept/route.ts`, `apps/web/app/api/assessments/[id]/signoff/route.ts`) still referenced the pre-restructuring `apps/web/app/(legal)/assessments/[id]/page.tsx` path. Separately, `apps/web/src/server/engine-invocation.ts`'s `coercePackForDemoEngine` still carried a `// DEMO-ONLY TRANSFORM` comment even though `06-01-PLAN.md`'s own acceptance criterion required that literal string removed once Phase 6 made the function real, ongoing machinery rather than a demo-only stand-in.

**Fix:** All five comments updated. The four route comments now point at the real `apps/web/app/legal/assessments/[id]/page.tsx` path. The engine-invocation comment now explains the coercion is real, ongoing machinery every workflow uses (06-RESEARCH.md's own Pattern 1) — substance unchanged, only the misleading "demo-only" framing removed.

**Commit:** `7d17239`

---

## Final Verified State

All 6 independently-found issues (1 Critical, 2 Warnings, 3 minor/docs items) are resolved — none deferred, none accepted-risk.

| Finding | Severity | Status | Commit |
|---------|----------|--------|--------|
| CR-01 | Critical | Fixed | `cf97cd8` |
| WR-01 | Warning | Fixed | `62c868d` |
| WR-02 | Warning | Fixed | `5ee8350` |
| IN-01 | Info | Fixed | `8887b02` |
| IN-02 (paths + DEMO-ONLY TRANSFORM) | Info/docs | Fixed | `7d17239` |

**Test suite:** 949/949 at baseline (start of this addendum's work) → 953/953 after all fixes (4 new tests added: 1 for CR-01, 1 for WR-01, 2 for WR-02). `pnpm run lint`, `pnpm run typecheck`, and `pnpm run depcruise` all clean after every commit.

**Security posture:** unchanged and confirmed good — the independent security-auditor's SECURED (20/20, 0 open) finding for Phase 6 stands; this addendum's WR-02 closes a latent (not-currently-exploitable) instance of a bug class the security audit's own scope had already checked for and found none of in this phase.

**Recorded observation:** the recurring authorization-gap bug class from Phases 3.1/4/5 genuinely did not recur here — a real, confirmed improvement, credited to Phase 6's own execution discipline. The Critical finding this phase produced was a different class entirely: a value silently computed without reading state that had already been correctly persisted and audited (`feeChoice`). Worth noting for future phases: additive fields threaded through `setFeeChoice`-style flows need an explicit check that every downstream consumer of the *outcome* (not just the *setter*) was updated to read the new field — the setter, the audit event, and the schema were all correct here; only the final consumer (`computeFinalAmount`) was not.

---

_Reviewed: 2026-09-20_
_Independent reviewers: fresh code-reviewer and security-auditor subagents_
_Fixes applied by: Claude (this session), verified against the full test/lint/typecheck/depcruise suite after each commit_
