---
phase: 06-convergence-and-legal-review
plan: 09
subsystem: testing
tags: [regression, hk, sg, review, bulk-accept]

requires:
  - phase: 06-01
    provides: per-jurisdiction pack resolution (resolveCurrentPackForJurisdiction), the golden HK/SG fixture line tables reused verbatim
  - phase: 06-03
    provides: "GET /api/assessments/{id} route, driven end-to-end by this plan's new HK fixture"
provides:
  - "First-ever real, non-SG end-to-end proof of REVIEW-01/02/04/12"
  - "Corrected, explicit proof that REVIEW-07's eligible set is empty against both real packs, for two distinct reasons"
affects: []

actuals:
  tokens: 4620
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - tests/routes/hk-jurisdiction-review.test.ts
    - tests/routes/bulk-accept-eligibility-real-packs.test.ts

key-decisions:
  - "No production code touched by this plan — every requirement it closes was already correctly implemented; this plan adds test coverage proving it against real, non-SG data for the first time"
  - "disposition-controls.test.tsx, line-card.test.tsx and info-request.test.ts (REVIEW-04/01/02/12/09's existing coverage) confirmed to carry zero diff in this plan's changeset, per this phase's own explicit scope-discipline instruction not to re-plan already-correct behavior"

requirements-completed: [REVIEW-01, REVIEW-02, REVIEW-04, REVIEW-07, REVIEW-09, REVIEW-12]

coverage:
  - id: D1
    description: "REVIEW-01/02/04/12 proven against real HK jurisdiction data (not SG) for the first time in this codebase's history"
    requirement: REVIEW-01
    verification:
      - kind: integration
        ref: "tests/routes/hk-jurisdiction-review.test.ts#HK-JURISDICTION-REVIEW (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "REVIEW-07's bulk-accept eligible set confirmed empty against both real committed packs, for two distinct, separately-verified reasons"
    requirement: REVIEW-07
    verification:
      - kind: integration
        ref: "tests/routes/bulk-accept-eligibility-real-packs.test.ts#BULK-ACCEPT-REAL-PACKS (2 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "REVIEW-02, REVIEW-04, REVIEW-09, REVIEW-12's pre-existing coverage (disposition-controls.test.tsx, line-card.test.tsx, info-request.test.ts) confirmed still passing, unmodified"
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/disposition-controls.test.tsx, apps/web/src/ui/review/line-card.test.tsx, tests/routes/info-request.test.ts (pre-existing, reconfirmed)"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 9: Regression Sweep — Real HK/SG Data Summary

**Closed out Phase 6 by proving, for the first time against a real jurisdiction other than SG, the six REVIEW-* requirements already fully built in Phases 3.1/4 — no production code touched, only new end-to-end test coverage exercising already-correct behavior against real HK data and correcting 06-RESEARCH.md's own imprecise claim about REVIEW-07's real-pack behavior.**

## Performance

- **Duration:** 30 min
- **Tasks:** 2
- **Files modified:** 2 (both created)

## Accomplishments
- `tests/routes/hk-jurisdiction-review.test.ts` (5 tests): drives the real create-matter → add-lines → submit → GET-for-review pipeline against a real HK matter (reusing Plan 06-01's own hand-derived, already-verified golden-fixture table), proving REVIEW-01 (every line carries a non-empty `appliedRuleId`/`basis`/`citation`), REVIEW-02 (the `OTHER_UNCLASSIFIED` line's `flagReasons` is non-empty), REVIEW-04 (HK's own pack — not SG's — genuinely governed the computation, via `ALLOW`/`DISALLOW`/`ALLOW_CAPPED`/`FLAG` verdict presence), and REVIEW-12 (each response line round-trips to a real submitted expense line) against real, non-SG jurisdiction data for the first time in this codebase's history
- `tests/routes/bulk-accept-eligibility-real-packs.test.ts` (2 tests): proves `listBulkAcceptableLineIds` returns an empty set against BOTH real committed packs, each for its own distinct, separately-verified reason — HK's one `VERIFIED` rule (`STAFF_TIME_LEGAL_REVIEW`) carries `DISALLOW` treatment and can never produce an `ALLOW` verdict; SG has zero `VERIFIED` category rules at all — correcting 06-RESEARCH.md's own imprecise framing
- Confirmed `disposition-controls.test.tsx` (REVIEW-04), `line-card.test.tsx` (REVIEW-01/02/12) and `tests/routes/info-request.test.ts` (REVIEW-09) all still pass, unmodified — zero production code change needed for any of the six requirements this plan closes
- Full `pnpm test` suite: 940 → 947 passing (7 new), confirmed green across two consecutive runs (one run hit the pre-existing, WINDOWS.md-documented CPU-load-sensitive property-test timeout; the immediate re-run passed cleanly)

## Task Commits

1. **Task 1: An HK-jurisdiction end-to-end route test — REVIEW-01/02/04/12 against real, non-SG data** - `df62981` (test)
2. **Task 2: REVIEW-07's corrected eligibility proof against both real packs, plus full-suite confirmation** - `ddeac81` (test)

## Files Created/Modified
- `tests/routes/hk-jurisdiction-review.test.ts` - new, 5 tests, tagged HK-JURISDICTION-REVIEW
- `tests/routes/bulk-accept-eligibility-real-packs.test.ts` - new, 2 tests, tagged BULK-ACCEPT-REAL-PACKS

## Decisions Made
- Both new HK fixtures reuse Plan 06-01's own hand-derived, already-verified category/quantity/rate table rather than inventing new values — every expected verdict was already known correct before writing these tests, and both files passed on their first run with no correction needed to the underlying data (only a materiality-threshold padding line was needed in the bulk-accept test's SG case, matching the same technique 06-07's fee-choice.test.ts already established)
- No production code touched anywhere in this plan — every requirement it closes was already correctly implemented in earlier phases; this plan's entire job is proving that against real, previously-untested jurisdiction data

## Deviations from Plan

None from this plan's own specified behavior — it executed exactly as written, adding only test coverage as scoped. One significant, unrelated environmental discovery is recorded below since it was directly observed during this plan's own verification loop and is relevant to Phase 6's closeout.

## Issues Encountered

**A concurrent process was found actively modifying this shared worktree in real time during this plan's execution**, independent of this agent's own work. Observed via repeated `git status` checks during Task 2's verification: files this agent had already committed in Plan 06-07 (`apps/web/app/legal/assessments/[id]/page.tsx`, `apps/web/src/ui/review/recompute-confirm.tsx`) showed new, unstaged, in-progress modifications appearing between consecutive status checks, along with new untracked files (`apps/web/src/domain/recompute-banner.ts` and its test, plus an unrelated `apps/web/src/domain/pack-display-status.ts` fix for a pre-existing Phase 05 defect). Inspection of the diffs showed a genuine, well-reasoned, correctly-authored bug fix: `recompute-confirm.tsx` carries `"use client"`, but this agent's own 06-07 Task 3 had exported `shouldRenderRecomputeBanner` from it and called it directly from `apps/web/app/legal/assessments/[id]/page.tsx`, a Server Component — the identical defect class Phase 05's `humanizePackDisplayStatus`/`pack-display-status.ts` relocation already fixed once (a Server Component cannot call a function from a `"use client"` module; Next.js refuses this at runtime). The in-progress fix correctly relocates `shouldRenderRecomputeBanner` to a new `apps/web/src/domain/recompute-banner.ts` module with no `"use client"` directive.

This agent did **not** touch, stage, revert, or commit any part of that in-progress work — it is not part of this plan's scope, and interfering with visibly-still-changing files in a shared worktree risked destroying legitimate concurrent work in progress (per this project's own worktree-safety discipline). This agent's own commits (`df62981`, `ddeac81`) were each verified, via `git show --stat` immediately after committing, to contain only the single file each was intended to contain — no contamination from the concurrent activity. **This is flagged for the orchestrator's attention**: `apps/web/src/ui/review/recompute-confirm.tsx` (as delivered by this agent in Plan 06-07) has a genuine "use client"-boundary bug that would crash the legal review page at runtime, exactly the defect class this concurrent fix addresses — whoever is performing that fix should be allowed to complete and commit it, or a follow-up plan should adopt it explicitly.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
All 19 Phase 6 requirement IDs are now genuinely complete, and the full suite is green. **One caveat for phase closeout**: the concurrent, uncommitted fix described above (`recompute-banner.ts` extraction) addresses a real runtime defect in this phase's own Plan 06-07 deliverable and should be verified as committed — either by the process already performing it, or explicitly adopted into this phase's history — before Phase 6 is considered fully hardened for a live demo walkthrough.

## Self-Check: PASSED

- FOUND: tests/routes/hk-jurisdiction-review.test.ts
- FOUND: tests/routes/bulk-accept-eligibility-real-packs.test.ts
- FOUND commit: df62981
- FOUND commit: ddeac81

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
