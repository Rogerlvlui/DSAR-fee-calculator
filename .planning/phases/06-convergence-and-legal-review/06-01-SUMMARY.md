---
phase: 06-convergence-and-legal-review
plan: 01
subsystem: engine
tags: [rule-packs, jurisdiction-resolution, golden-tests, vitest]

requires:
  - phase: 03-rule-packs-and-pack-admin
    provides: HK-PDPO and SG-PDPA committed rule packs (authored subset), loader.ts's resolveRulePack/loadAllRulePacks
provides:
  - resolveCurrentPackForJurisdiction (new assessments, by matter.jurisdictionCode)
  - resolvePinnedRulePack (review-time reads, by assessment's own pinned rulePackId/rulePackVersion)
  - findLoadedPackForJurisdiction (jurisdiction-packs.ts, single lookup shared by both callers)
  - ENGINE-14 golden-file proof for real HK-PDPO/SG-PDPA content
affects: [06-02, 06-03, 06-04, 06-05, 06-06, 06-07, 06-08, 06-09]

actuals:
  tokens: 11070
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Pack resolution split by call-site intent: resolveCurrentPackForJurisdiction for new assessments, resolvePinnedRulePack for review-time reads of an existing assessment — never a single 'get the pack' function serving both"

key-files:
  created:
    - packages/rulepacks/src/real-pack-fixture.golden.test.ts
  modified:
    - apps/web/src/server/engine-invocation.ts
    - apps/web/src/server/jurisdiction-packs.ts
    - apps/web/src/server/jurisdiction-packs.test.ts
    - apps/web/src/server/review-view.ts
    - apps/web/src/server/data/assessments.ts
    - apps/web/src/server/data/matters.ts
    - apps/web/app/(legal)/assessments/[id]/page.tsx
    - apps/web/app/(hr)/matters/[id]/page.tsx
    - tests/routes/honesty.test.ts
    - tests/routes/signoff.test.ts

key-decisions:
  - "engine-invocation.ts's DEMO_PACK_ID/DEMO_PACK_VERSION/loadDemoPack() deleted outright, no re-export shim, per this codebase's established delete-the-stand-in precedent"
  - "bulkAcceptLines's pack parameter changed from a defaulted parameter to an optional one resolved inside the function body once assessment is fetched — a default parameter cannot reference a value not yet in scope"
  - "The golden-file test lives in packages/rulepacks/src/, not packages/engine/src/ as 06-RESEARCH.md tentatively suggested, confirmed via package.json reads that packages/engine has zero dependency on @dsar/rulepacks"

requirements-completed: [ENGINE-14]

coverage:
  - id: D1
    description: "Every jurisdiction's matter is assessed against its own committed rule pack (resolveCurrentPackForJurisdiction), not a single SG-hardcoded one"
    requirement: ENGINE-14
    verification:
      - kind: unit
        ref: "apps/web/src/server/jurisdiction-packs.test.ts#JURISDICTION-PACKS: findLoadedPackForJurisdiction"
        status: pass
      - kind: manual_procedural
        ref: "ad-hoc script: resolveCurrentPackForJurisdiction('HK') resolves HK-PDPO, resolveCurrentPackForJurisdiction('SG') resolves SG-PDPA"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every review-time read (review screen, bulk-accept, sign-off attestation) resolves the assessment's own pinned rulePackId/rulePackVersion, never 'whichever pack is current'"
    requirement: ENGINE-14
    verification:
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF"
        status: pass
      - kind: integration
        ref: "tests/routes/honesty.test.ts#HONESTY"
        status: pass
    human_judgment: false
  - id: D3
    description: "AC-09's golden files pass for real HK-PDPO and SG-PDPA packs against their actually-authored categories, and a mutation of a pack's own content (in-memory only) breaks the golden file"
    requirement: ENGINE-14
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/real-pack-fixture.golden.test.ts#REAL-PACK-GOLDEN (12 tests)"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 1: Pack Resolution Generalization + ENGINE-14 Golden Files Summary

**Replaced engine-invocation.ts's Phase 3.1 SG-only pack hardcode with jurisdiction-scoped (new assessments) and pin-scoped (review-time reads) resolution, then proved assess() against real HK-PDPO/SG-PDPA content with 12 hand-derived golden-file assertions.**

## Performance

- **Duration:** 55 min
- **Tasks:** 2
- **Files modified:** 11 (10 modified, 1 created)

## Accomplishments
- `resolveCurrentPackForJurisdiction(jurisdictionCode)` and `resolvePinnedRulePack(rulePackId, rulePackVersion)` replace `loadDemoPack()` at all ten call sites (review-view, three in data/assessments.ts, three in data/matters.ts, two page.tsx files, two test files) — every non-SG jurisdiction's matter now resolves its own real pack instead of silently being assessed against SG-PDPA
- `findLoadedPackForJurisdiction` added to jurisdiction-packs.ts as the single lookup both `resolveJurisdictionPackViews` and the new engine-invocation resolvers share
- ENGINE-14/AC-09 golden-file suite (`packages/rulepacks/src/real-pack-fixture.golden.test.ts`, 12 tests) proves `assess()` reproduces exact verdicts, engine amounts, caps, flag reasons, totals and matter-level flags for both real committed packs' authored subsets (9/21 HK, 6/21 SG), plus a mutation-sensitivity test proving the golden assertions are not tautological
- Full `pnpm test` suite: 838 (baseline) → 852 passing, zero regressions

## Task Commits

1. **Task 1: Generalize pack resolution — by jurisdiction for new assessments, by pinned version for existing ones** - `0c47149` (feat)
2. **Task 2: ENGINE-14 golden files — real HK-PDPO and SG-PDPA content** - `5dfe375` (test)

**Plan metadata:** (this summary's own commit, following)

## Files Created/Modified
- `apps/web/src/server/engine-invocation.ts` - loadDemoPack/DEMO_PACK_ID/DEMO_PACK_VERSION deleted; resolveCurrentPackForJurisdiction and resolvePinnedRulePack added
- `apps/web/src/server/jurisdiction-packs.ts` - findLoadedPackForJurisdiction extracted, reused by resolveJurisdictionPackViews
- `apps/web/src/server/jurisdiction-packs.test.ts` - 2 new tests for findLoadedPackForJurisdiction
- `apps/web/src/server/review-view.ts` - resolves the assessment's own pinned pack
- `apps/web/src/server/data/assessments.ts` - listBulkAcceptableLineIds/bulkAcceptLines/signOff all resolve pinned pack
- `apps/web/src/server/data/matters.ts` - submitForAssessment/resubmitAfterInfoRequest/recomputeAgainstCurrentPack all resolve by jurisdiction
- `apps/web/app/(legal)/assessments/[id]/page.tsx` - resolves pinned pack for status strip and review view
- `apps/web/app/(hr)/matters/[id]/page.tsx` - resolves pinned pack for notice draft
- `tests/routes/honesty.test.ts` - pinned literal SG-PDPA/2026.09.1 (same pack loadDemoPack always resolved)
- `tests/routes/signoff.test.ts` - resolves the fixture assessment's own pinned pack; FixtureAssessment type widened with rulePackId/rulePackVersion
- `packages/rulepacks/src/real-pack-fixture.golden.test.ts` - new ENGINE-14 golden-file suite (12 tests)

## Decisions Made
- Deleted `loadDemoPack`/`DEMO_PACK_ID`/`DEMO_PACK_VERSION` outright with no re-export shim, matching this codebase's established "delete the stand-in" precedent (Phase 4/5)
- `bulkAcceptLines`'s `pack` parameter changed from a self-referencing default (`ReturnType<typeof loadDemoPack> = loadDemoPack()`) to a plain optional `LoadableRulePack | undefined`, resolved inside the function body once `assessment` is fetched — a default parameter cannot reference a value not yet in scope
- Golden-file test placed in `packages/rulepacks/src/`, not `packages/engine/src/` as 06-RESEARCH.md tentatively suggested — confirmed via `package.json` reads that `packages/engine` has zero dependency on `@dsar/rulepacks`
- Every hand-derived golden-file number (HK and SG totals, caps, flags) was independently re-derived from each pack's own JSON before writing the test, then confirmed by the test's own first run — all 12 assertions passed on the first execution, with no number needing correction

## Deviations from Plan

None - plan executed exactly as written. One small necessary addition not explicitly named in the plan: `tests/routes/signoff.test.ts`'s local `FixtureAssessment` interface needed `rulePackId`/`rulePackVersion` fields added (the real route response already includes them; the test's own narrow interface simply hadn't declared them) — a straightforward Rule 3 fix required to make the plan's own specified `resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion)` substitution typecheck.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Widened FixtureAssessment interface with rulePackId/rulePackVersion**
- **Found during:** Task 1 (typecheck after the signoff.test.ts substitution)
- **Issue:** The test's local `FixtureAssessment` type didn't declare `rulePackId`/`rulePackVersion`, even though the real JSON response already carries them — blocking the plan's own specified `resolvePinnedRulePack(assessment.rulePackId, assessment.rulePackVersion)` call from typechecking
- **Fix:** Added both fields to the interface
- **Files modified:** tests/routes/signoff.test.ts
- **Verification:** `pnpm run typecheck` exits 0; SIGNOFF tests pass
- **Committed in:** 0c47149 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** No scope creep — a one-line type widening required for the plan's own specified change to typecheck.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Every later Phase 6 plan can now rely on `engine-invocation.ts` correctly resolving a matter's own jurisdiction (new assessments) or an assessment's own pinned version (review-time reads) — the central technical unlock this phase's brief names explicitly. No blockers for Wave 2 (06-04, 06-05).

## Self-Check: PASSED

- FOUND: apps/web/src/server/engine-invocation.ts
- FOUND: packages/rulepacks/src/real-pack-fixture.golden.test.ts
- FOUND commit: 0c47149
- FOUND commit: 5dfe375

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
