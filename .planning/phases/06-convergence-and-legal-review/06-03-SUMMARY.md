---
phase: 06-convergence-and-legal-review
plan: 03
subsystem: api
tags: [authorization, rsc, access-control, vitest, next.js]

requires:
  - phase: 06-01
    provides: resolvePinnedRulePack/resolveCurrentPackForJurisdiction (used transitively by the fixture pipeline this plan's tests drive)
provides:
  - "GET /api/assessments/{id} route (AC-01)"
  - ACCESS-CONTROL-REVIEW test suite (ACCESS-02/ACCESS-03)
  - RSC-PAYLOAD-LEAK source-scan test + canary fixture (ACCESS-07)
  - REVIEW-06 rendered-output proof
affects: [06-04, 06-06]

actuals:
  tokens: 5755
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Privileged-type prop scan: text-level import + type-annotation regex scan over every \"use client\" .tsx file, proven non-vacuous by a dedicated canary fixture — mirrors dom-denylist.test.ts's established glob+component+canary structure"

key-files:
  created:
    - "apps/web/app/api/assessments/[id]/route.ts"
    - tests/routes/access-control-review.test.ts
    - tests/boundary/rsc-payload-leak.test.ts
    - tests/fixtures/rsc-payload-leak-canary.fixture.tsx
  modified:
    - tests/tsconfig.json

key-decisions:
  - "GET /api/assessments/{id} adds zero new authorization logic — it delegates entirely to getAssessmentForLegalReview's existing LEGAL_REVIEWER gate, per the plan's own acceptance criterion (grep for requireRole/actor.role in the route file must be empty)"
  - "ACCESS-03's SIGNED_OFF case drives a matter through the full disposition+signoff pipeline (mirroring tests/routes/signoff.test.ts's own established shape) rather than asserting only against a LEGAL_REVIEW-status matter, so the role gate's status-independence is genuinely proven, not merely assumed"
  - "REVIEW-06's negative assertion is scoped to TotalsRail's headline block specifically, not the whole rendered page — the totals-rows section legitimately always shows draftBaseline (pending or not); AC-25's guarantee is about the recommended-fee headline never showing a figure while pending"
  - "tests/tsconfig.json's include list widened by one entry (apps/web/src/ui/review/totals-rail.tsx) — the same targeted-widening pattern every prior addition to this file already established, not a blanket glob"

requirements-completed: [ACCESS-02, ACCESS-03, ACCESS-07, REVIEW-06]

coverage:
  - id: D1
    description: "GET /api/assessments/{id} exists exactly as AC-01 names it, LEGAL_REVIEWER-only regardless of matter status"
    requirement: ACCESS-02
    verification:
      - kind: integration
        ref: "tests/routes/access-control-review.test.ts#ACCESS-CONTROL-REVIEW (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No API response to an HR_PREPARER contains verdict/engineAmount/basis/draftBaseline/lawyerReason for a matter not in SIGNED_OFF, including the default no-cookie identity and a matter that has since reached SIGNED_OFF"
    requirement: ACCESS-03
    verification:
      - kind: integration
        ref: "tests/routes/access-control-review.test.ts#ACCESS-CONTROL-REVIEW: this route is LEGAL_REVIEWER-only regardless of matter status"
        status: pass
    human_judgment: false
  - id: D3
    description: "No 'use client' component under apps/web/src/ui/** accepts a whole Assessment/AssessmentLine/SignOff object as a prop, proven non-vacuous by a canary fixture"
    requirement: ACCESS-07
    verification:
      - kind: unit
        ref: "tests/boundary/rsc-payload-leak.test.ts#RSC-PAYLOAD-LEAK (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "TotalsRail's headline block renders no formatted money figure while any line is PENDING, proven against real rendered output"
    requirement: REVIEW-06
    verification:
      - kind: unit
        ref: "tests/boundary/rsc-payload-leak.test.ts#REVIEW-06: TotalsRail's headline block contains the hidden-state marker and NO formatted money figure"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 3: GET /api/assessments/{id} + Access-Control and Leak-Channel Proofs Summary

**New `GET /api/assessments/{id}` route with zero new authorization logic, plus three previously-nonexistent explicit tests: HR gets 403 with no leaked body regardless of matter status (ACCESS-02/03), no `"use client"` component leaks a whole privileged object across the RSC boundary (ACCESS-07, proven non-vacuous by a canary), and TotalsRail's headline never shows a figure while any line is pending (REVIEW-06).**

## Performance

- **Duration:** 45 min
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `GET /api/assessments/{id}` (AC-01) created — a thin handler delegating 100% of authorization and lookup to the already-gated `getAssessmentForLegalReview`
- `tests/routes/access-control-review.test.ts` (4 tests): HR with an explicit cookie gets 403/no-leak; HR with no cookie at all (default identity) gets identical treatment; a LEGAL_REVIEWER gets 200 with the real body; the role gate holds even once the matter reaches SIGNED_OFF (driven through the full real disposition+signoff pipeline)
- `tests/boundary/rsc-payload-leak.test.ts` (3 tests) + `tests/fixtures/rsc-payload-leak-canary.fixture.tsx`: a source-scan proving zero real `"use client"` component under `apps/web/src/ui/**` accepts a whole `Assessment`/`AssessmentLine`/`SignOff` prop, proven non-vacuous by the canary fixture catching a deliberate violation
- REVIEW-06's negative assertion proves `TotalsRail`'s headline block carries no formatted money figure while any line is `PENDING` — the missing half of an existing marker-only check
- Full `pnpm test` suite: 855 → 862 passing, zero regressions

## Task Commits

1. **Task 1: GET /api/assessments/{id} — the literal AC-01 route, and the ACCESS-02/03 leak-channel proof** - `800a809` (feat)
2. **Task 2: ACCESS-07's RSC-payload leak proof, and REVIEW-06's rendered-output proof** - `7a7c68d` (feat)

## Files Created/Modified
- `apps/web/app/api/assessments/[id]/route.ts` - new GET handler, zero new authorization logic
- `tests/routes/access-control-review.test.ts` - ACCESS-02/03 explicit tests, 4 cases
- `tests/boundary/rsc-payload-leak.test.ts` - ACCESS-07 scanner + REVIEW-06 rendered-output proof, 3 cases
- `tests/fixtures/rsc-payload-leak-canary.fixture.tsx` - deliberately-violating canary component
- `tests/tsconfig.json` - widened include list with `apps/web/src/ui/review/totals-rail.tsx`

## Decisions Made
- `GET /api/assessments/{id}` mirrors `./signoff/route.ts`'s exact thin-handler shape — no new authorization logic, confirmed by the plan's own `grep -n "requireRole\|actor.role"` acceptance criterion returning empty (required rewording one code comment that had literally contained the word "requireRole")
- ACCESS-03's SIGNED_OFF case drives the fixture matter through the real disposition (ACCEPT/STRIKE per verdict) and sign-off pipeline, mirroring `tests/routes/signoff.test.ts`'s own established shape, rather than asserting the weaker "still in LEGAL_REVIEW" case a second time — this genuinely proves the role gate does not vary by matter status
- REVIEW-06's negative assertion is scoped to the `headline` block's own HTML slice, not the whole rendered component — `TotalsRail`'s five/seven totals-rows legitimately always show `draftBaseline` and friends (that is existing, correct, non-pending-gated behavior); AC-25's actual guarantee is that the **recommended-fee headline** specifically shows no figure while pending
- `tests/tsconfig.json` widened by one targeted entry, following every prior addition's own established pattern (not a blanket glob)

## Deviations from Plan

None — plan executed exactly as written, with the two clarifications above (ACCESS-03's real SIGNED_OFF pipeline, REVIEW-06's headline-scoped assertion) both resolving genuine ambiguity in the plan's own prose in the way that best honoured its stated intent (the acceptance criteria explicitly required proving each fact, not merely a passing assertion).

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Route module comment accidentally matched its own acceptance-criteria grep**
- **Found during:** Task 1
- **Issue:** The route file's own header comment used the literal phrase "requireRole(actor, ...)" to explain why no new authorization logic was needed — which is exactly the string the plan's acceptance criterion greps for, causing a false-positive match against the comment rather than actual code
- **Fix:** Reworded the comment to describe the same fact without using the literal token
- **Files modified:** apps/web/app/api/assessments/[id]/route.ts
- **Verification:** `grep -n "requireRole\|actor.role" apps/web/app/api/assessments/[id]/route.ts` now returns no output
- **Committed in:** 800a809 (Task 1 commit)

**2. [Rule 3 - Blocking] tests/tsconfig.json missing totals-rail.tsx**
- **Found during:** Task 2 (typecheck)
- **Issue:** `tests/boundary/rsc-payload-leak.test.ts` imports `TotalsRail` directly, which is not resolvable under `tests/tsconfig.json`'s targeted include list (TS6307)
- **Fix:** Added `../apps/web/src/ui/review/totals-rail.tsx` as one more targeted entry, following the file's own established pattern
- **Files modified:** tests/tsconfig.json
- **Verification:** `pnpm run typecheck` exits 0
- **Committed in:** 7a7c68d (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both blocking, no scope creep)
**Impact on plan:** None on delivered behavior.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Wave 2's route restructuring (06-04) now has a real `GET /api/assessments/{id}` route to move alongside every other route file, and an explicit, continuously-enforced RSC-payload-leak gate that any later plan adding a new `"use client"` review component will fail against if it regresses. No blockers.

## Self-Check: PASSED

- FOUND: apps/web/app/api/assessments/[id]/route.ts
- FOUND: tests/boundary/rsc-payload-leak.test.ts
- FOUND commit: 800a809
- FOUND commit: 7a7c68d

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
