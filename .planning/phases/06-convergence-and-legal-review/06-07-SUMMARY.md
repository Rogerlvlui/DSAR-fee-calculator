---
phase: 06-convergence-and-legal-review
plan: 07
subsystem: review
tags: [flat-fee, recompute, audit, schemas, ui]

requires:
  - phase: 06-01
    provides: resolveCurrentPackForJurisdiction (reused verbatim for REVIEW-10's gating condition)
  - phase: 06-04
    provides: "/legal/assessments/[id] as a real, reachable path"
  - phase: 06-05
    provides: no direct dependency, sequenced after per depends_on (same data/assessments.ts file)
provides:
  - "Assessment.feeChoice (additive schema field)"
  - "FEE_CHOICE_SET audit event + feeChoicePayload builder"
  - setFeeChoice server gate + POST /api/assessments/{id}/fee-choice
  - FlatFeeChoice review-screen UI (REVIEW-11)
  - RecomputeConfirm in-place confirmation banner + shouldRenderRecomputeBanner gate (REVIEW-10)
affects: [06-09]

actuals:
  tokens: 12999
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Pure gate function (shouldRenderRecomputeBanner) extracted from a page-level conditional so a rarely-true-today condition is directly, separately testable in both directions"

key-files:
  created:
    - "apps/web/app/api/assessments/[id]/fee-choice/route.ts"
    - apps/web/src/ui/review/flat-fee-choice.tsx
    - apps/web/src/ui/review/recompute-confirm.tsx
  modified:
    - packages/schemas/src/assessment.ts
    - packages/schemas/src/primitives.ts
    - packages/audit/src/payload-builders.ts
    - apps/web/src/server/data/assessments.ts
    - apps/web/src/ui/review/assessment-view.tsx
    - "apps/web/app/legal/assessments/[id]/page.tsx"

key-decisions:
  - "Assessment.feeChoice added as z.enum([\"ITEMISED\",\"FLAT\"]).optional(), mirroring FlatFeeComparisonSchema's own D-12 additive precedent exactly — every existing Assessment JSON without the key still parses unchanged"
  - "FEE_CHOICE_SET added as an eighteenth, additive AuditEventTypeSchema value, mirroring MatterFlagCodeSchema's own AGGREGATE_CAP_APPLIED (D-11) precedent — not a PRD §6.0 transcription"
  - "setFeeChoice reuses requireAssessmentInLegalReview verbatim (no new precondition invented) and refuses FLAT server-side when flatFeeExceedsItemisedCost, proven by its own dedicated test independent of the UI's disabled radio"
  - "FlatFeeChoice/RecomputeConfirm both follow disposition-controls.tsx's exact pure-View/stateful-wrapper split — useRouter() throws outside a real Next.js request, so only the pure View is ever rendered directly in tests"
  - "shouldRenderRecomputeBanner extracted as its own small pure function (not an inline page.tsx conditional) specifically so the gating logic is directly testable in both directions without a live page render"
  - "Regenerated the committed JSON Schema artifact (assessment.schema.json) for the additive feeChoice field, and updated tests/routes/lifecycle.test.ts's WRITTEN_THIS_PHASE accounting to include FEE_CHOICE_SET — both required to keep the full suite green, not scope creep"

requirements-completed: [REVIEW-10, REVIEW-11]

coverage:
  - id: D1
    description: "The lawyer's flat-fee-vs-itemised choice is persisted on the Assessment the moment it is chosen, gated server-side (refuses FLAT when it exceeds itemised cost, refuses when no flat fee exists), and audited"
    requirement: REVIEW-11
    verification:
      - kind: unit
        ref: "packages/schemas/src/assessment.test.ts#AssessmentSchema — feeChoice (06-07, additive)"
        status: pass
      - kind: integration
        ref: "tests/routes/fee-choice.test.ts#FEE-CHOICE (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Where the pack carries a flat fee, the lawyer sees both figures side by side, the flat radio is structurally disabled when it would exceed itemised cost, and the unverified marker coexists with (never replaces) the blocked note"
    requirement: REVIEW-11
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/flat-fee-choice.test.tsx#FLAT-FEE-CHOICE (9 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The recompute affordance is wired end-to-end through the already-tested recompute route, requires an explicit in-place (never modal) confirmation naming what will be discarded, and is honestly inert against every real committed pack today"
    requirement: REVIEW-10
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/recompute-confirm.test.tsx#RECOMPUTE-CONFIRM (7 tests, both gating directions)"
        status: pass
      - kind: integration
        ref: "tests/routes/recompute.test.ts (pre-existing, reconfirmed unchanged)"
        status: pass
    human_judgment: false

duration: 90min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 7: Flat-Fee Choice + Recompute Confirmation Summary

**Gave the lawyer two review-screen affordances the engine and workflow guard table already supported end-to-end but had no UI for: choosing between the itemised and flat figure where the pack carries one (REVIEW-11, `Assessment.feeChoice` + `FlatFeeChoice`), and recomputing against the jurisdiction's current pack with an explicit, in-place, non-modal confirmation of what will be discarded (REVIEW-10, `RecomputeConfirm`).**

## Performance

- **Duration:** 90 min
- **Tasks:** 3
- **Files modified:** 17 (7 created, 10 modified)

## Accomplishments
- `Assessment.feeChoice` (additive `.optional()` field) and an eighteenth `AuditEventTypeSchema` value, `FEE_CHOICE_SET`, both following this codebase's own established additive-extension precedents (D-12, D-11)
- `setFeeChoice` (the authoritative server gate) + `POST /api/assessments/{id}/fee-choice`: refuses when no flat fee exists for the pack, refuses `FLAT` when it exceeds itemised direct cost (proven server-side, independent of any client-side UI), succeeds unconditionally for `ITEMISED`, and records a `FEE_CHOICE_SET` audit event
- `FlatFeeChoice` (pure `FlatFeeChoiceView` + stateful wrapper): renders nothing when the pack carries no flat fee; the flat radio is structurally disabled (not merely discouraged by copy) when it would exceed itemised cost; the unverified-rule marker and the blocked note are proven to coexist without collapsing into one visual state; every copy string transcribed verbatim from the UI-SPEC
- `RecomputeConfirm` (pure `RecomputeConfirmView` + stateful wrapper) + `shouldRenderRecomputeBanner`: an in-place, non-modal expand-to-confirm banner naming exactly what will be discarded, gated by a small pure function proven correct in both directions (renders on a genuine version mismatch, renders nothing when identical — today's real case for every committed pack)
- Both new UI affordances composed into `assessment-view.tsx` (new `flatFeeChoice`/`recomputeBanner` slots) and the legal review page, with narrow scalar-only props crossing the `"use client"` boundary — never the whole `Assessment` object, per the RSC-payload-leak discipline Plan 06-03 made an explicit, tested gate
- `getCurrentActor`/`requireRole` call-site count on the legal review page confirmed unchanged (2) across both UI wirings
- Full `pnpm test` suite: 887 → 912 passing (25 new), zero regressions

## Task Commits

1. **Task 1: Assessment.feeChoice, the FEE_CHOICE_SET audit event, and setFeeChoice's server gate** - `359609c` (feat)
2. **Task 2: FlatFeeChoice — the review-screen UI (REVIEW-11)** - `61123d4` (feat)
3. **Task 3: RecomputeConfirm — the in-place, non-modal confirmation banner (REVIEW-10)** - `d0d9c23` (feat)

## Files Created/Modified
- `packages/schemas/src/assessment.ts` / `.test.ts` - `Assessment.feeChoice`, `FeeChoiceSchema`
- `packages/schemas/src/primitives.ts` / `.test.ts` - `FEE_CHOICE_SET` added to `AuditEventTypeSchema`
- `packages/schemas/schema/assessment.schema.json` - regenerated for the additive `feeChoice` field
- `packages/audit/src/payload-builders.ts` - `feeChoicePayload`
- `apps/web/src/server/data/assessments.ts` - `setFeeChoice`
- `apps/web/app/api/assessments/[id]/fee-choice/route.ts` - new thin POST route
- `tests/routes/fee-choice.test.ts` - new, 6 tests
- `tests/routes/lifecycle.test.ts` - `FEE_CHOICE_SET` added to `WRITTEN_THIS_PHASE`
- `apps/web/src/ui/review/flat-fee-choice.tsx` / `.test.tsx` - new, 9 tests
- `apps/web/src/ui/review/recompute-confirm.tsx` / `.test.tsx` - new, 7 tests
- `apps/web/src/ui/review/assessment-view.tsx` - `flatFeeChoice`/`recomputeBanner` optional slots
- `apps/web/app/legal/assessments/[id]/page.tsx` - both new affordances composed with narrow scalar props
- `tests/routes/legal-queue.test.ts` - unrelated latent `exactOptionalPropertyTypes` fix surfaced by this task's typecheck run (see Deviations)

## Decisions Made
- `Assessment.feeChoice` and `FEE_CHOICE_SET` both follow this codebase's own additive-extension conventions (D-12's `FlatFeeComparisonSchema`, D-11's `AGGREGATE_CAP_APPLIED`) rather than inventing a new pattern
- `setFeeChoice` reuses `requireAssessmentInLegalReview` verbatim — no new precondition invented for the "matter must be in legal review" rule
- `FlatFeeChoice`/`RecomputeConfirm` both follow `disposition-controls.tsx`'s exact pure-View/stateful-wrapper split, including its error-handling shape ("stays editable and stays pending" on failure)
- `shouldRenderRecomputeBanner` is a standalone exported pure function, not an inline page-level `!==` check — this makes REVIEW-10's gating condition directly testable in both directions without needing a live page render (the legal review page cannot be rendered directly in this test suite; it's loaded via dynamic import only where a route test specifically needs it)
- Regenerating `assessment.schema.json` and updating `lifecycle.test.ts`'s written/deferred accounting were both required consequences of the additive schema/enum changes, not scope creep — both are pre-existing drift-detection tests this project's own established conventions require to stay in sync with any schema change

## Deviations from Plan

None from the plan's own specified behavior. Two necessary corrections surfaced during this task's own verification loop:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Committed JSON Schema artifact drifted from the additive feeChoice field**
- **Found during:** Task 1 (full suite run)
- **Issue:** `packages/schemas/schema/assessment.schema.json` (a committed, byte-identical-regeneration-checked artifact) did not include the new `feeChoice` field, failing two pre-existing drift tests (`json-schema.test.ts`, `rule-pack.test.ts`)
- **Fix:** Ran the existing `node packages/schemas/scripts/generate-json-schema.ts` regeneration script and committed the updated artifact
- **Files modified:** packages/schemas/schema/assessment.schema.json
- **Verification:** Both previously-failing drift tests pass
- **Committed in:** 359609c (Task 1 commit)

**2. [Rule 3 - Blocking] lifecycle.test.ts's audit-event-type accounting did not include FEE_CHOICE_SET**
- **Found during:** Task 1 (full suite run)
- **Issue:** `tests/routes/lifecycle.test.ts`'s own completeness test (every `AuditEventType` must be either written-this-phase or deliberately-deferred) failed once the enum grew to 18 members
- **Fix:** Added `FEE_CHOICE_SET` to `WRITTEN_THIS_PHASE` with a comment naming its real call site (`setFeeChoice`)
- **Files modified:** tests/routes/lifecycle.test.ts
- **Verification:** The completeness test passes
- **Committed in:** 359609c (Task 1 commit)

**3. [Rule 1 - Bug, unrelated to this plan] Latent exactOptionalPropertyTypes error in 06-06's own test file**
- **Found during:** Task 1 (typecheck run against the updated build graph)
- **Issue:** `tests/routes/legal-queue.test.ts`'s `renderQueue` helper passed `{ sort }` (typed `string | undefined`) into a `Promise<{ sort?: string }>` parameter under `exactOptionalPropertyTypes: true` — a pre-existing latent error from Plan 06-06, only now surfaced by this task's own full typecheck run against the changed dependency graph
- **Fix:** Rewrote the helper to omit the key entirely when `sort` is `undefined`, rather than passing an explicit `undefined` value
- **Files modified:** tests/routes/legal-queue.test.ts
- **Verification:** `pnpm run typecheck` exits 0; all 5 LEGAL-QUEUE tests still pass
- **Committed in:** 359609c (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking drift-test failures directly caused by this plan's additive schema changes, 1 unrelated latent type error surfaced incidentally) — no scope creep.

## Issues Encountered
None beyond the three corrections above, all resolved within Task 1's own verification loop.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
REVIEW-10 and REVIEW-11 are both fully wired end-to-end. Wave 5's regression sweep (06-09) can now exercise both new affordances against real HK/SG data. No blockers for Wave 4 (06-08, keyboard-first review flow — touches `disposition-controls.tsx`, which this plan did not modify).

## Self-Check: PASSED

- FOUND: apps/web/src/ui/review/flat-fee-choice.tsx
- FOUND: apps/web/src/ui/review/recompute-confirm.tsx
- FOUND commit: 359609c
- FOUND commit: 61123d4
- FOUND commit: d0d9c23

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
