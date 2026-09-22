---
phase: 05-hr-intake-and-disclosure-shell
plan: 01
subsystem: ui-disclosure-shell
tags: [react, next-app-router, capability-statement, status-strip, localStorage]

# Dependency graph
requires:
  - phase: 03.1-demo-slice
    provides: "CapabilityStatement (one-time click-through), StatusStrip (legal review's pack-status disclosure), both route-group shells as bare pass-throughs"
provides:
  - "CAPABILITY_STATEMENT_VERSION — a bumpable constant that forces every browser to re-see the capability statement, replacing Phase 3.1's un-versioned boolean ack"
  - "StatusStripProps.reviewedOn / .daysUntilReviewDue — the two AC-31 fields StatusStrip was missing, additive, Pack-status cell untouched"
  - "apps/web/app/(hr)/layout.tsx and apps/web/app/(legal)/layout.tsx now wrap children in CapabilityStatement — the single mount point for every present and future screen under /matters/* and /assessments/*"
affects: [05-hr-intake-and-disclosure-shell (05-03/05-04/05-05 compose StatusStrip onto new HR screens using this reconciled shape)]

# Actuals (#2632)
actuals:
  tokens: 5338
  tasks: 3
  commits: 3
  plan_head_before: 7c688774cab8e2f94c2d637b78783a2f0bca93c0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A version-comparison ack (Number.parseInt >= a bumpable constant) replaces a boolean ack, so a legacy sentinel (\"true\", which parses to NaN) falls through to \"not acknowledged\" with no special-casing"
    - "A route-group layout is the correct mount point for a whole-tree gate (no descendant params needed); a component needing a specific descendant's data (StatusStrip) stays a page-level composition instead"

key-files:
  created:
    - "apps/web/app/(hr)/layout.test.tsx"
    - "apps/web/app/(legal)/layout.test.tsx"
  modified:
    - apps/web/src/ui/capability/capability-statement.tsx
    - apps/web/src/ui/capability/capability-statement.test.tsx
    - apps/web/src/ui/chrome/status-strip.tsx
    - apps/web/src/ui/chrome/status-strip.test.tsx
    - apps/web/src/ui/honesty.test.tsx
    - "apps/web/app/(hr)/layout.tsx"
    - "apps/web/app/(legal)/layout.tsx"
    - "apps/web/app/(legal)/assessments/[id]/page.tsx"

key-decisions:
  - "StatusStrip's Review-due cell reuses matter-flags.ts's existing <= 30 STALE_PACK_WARNING boundary rather than inventing a second threshold"
  - "The Review-due cell is exempt from the 'Pack status always warns' constraint — it asserts calendar timing only, never a claim about authoring completeness"
  - "The legal review page's now is hoisted above the pendingCount branch so StatusStrip's daysUntilReviewDue and the existing packIsStale check share one per-request timestamp, never two"
  - "Rule 3 auto-fix: apps/web/src/ui/honesty.test.tsx's own StatusStrip call site (not in this plan's declared file list) needed the two new required props to typecheck — this was the intended forcing function acknowledged by the plan itself"

requirements-completed: [DISC-01, DISC-02]

coverage:
  - id: D1
    description: "Every screen under /matters/* and /assessments/* renders the capability statement until acknowledged, and re-shows automatically once CAPABILITY_STATEMENT_VERSION increments, enforced once at the route-group layout"
    requirement: "DISC-01"
    verification:
      - kind: unit
        ref: "apps/web/src/ui/capability/capability-statement.test.tsx#CAPABILITY — 12 tests covering version export, storage write, version-match/mismatch/legacy-sentinel/absent-key mount behavior"
        status: pass
      - kind: unit
        ref: "apps/web/app/(hr)/layout.test.tsx and apps/web/app/(legal)/layout.test.tsx#CAPABILITY — proves each layout gates children behind the statement's own markup rather than passing them through"
        status: pass
    human_judgment: false
  - id: D2
    description: "StatusStrip carries AC-31's full field list additively (Reviewed, Review-due tri-state) with the Phase 3.1 pack-status disclosure left completely intact"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "apps/web/src/ui/chrome/status-strip.test.tsx#STATUS-STRIP — 9 tests covering null/non-null reviewedOn, >30/==30/negative daysUntilReviewDue tri-state, and the unchanged Pack-status cell"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-19
status: complete
---

# Phase 5 Plan 1: Disclosure Shell Foundations Summary

**`CapabilityStatement` gains a bumpable version constant and is now mounted once at both route-group layouts; `StatusStrip` gains AC-31's two missing cells (Reviewed, Review-due) additively, with a shared per-request timestamp threading them into the legal review page's one existing call site.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 completed
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments

- `CAPABILITY_STATEMENT_VERSION` replaces Phase 3.1's un-versioned `"true"` ack; a future content change forces a re-show by bumping one constant, with the legacy sentinel and every other edge case falling through correctly with zero special-casing.
- `StatusStrip` now carries AC-31's full field list (`reviewedOn`, `daysUntilReviewDue`) as additive required props, deriving a tri-state Review-due label using the same `<= 30` boundary `matter-flags.ts`'s `STALE_PACK_WARNING` already established — one threshold in this codebase, not two.
- Both `(hr)` and `(legal)` route-group layouts now mount `CapabilityStatement` once, covering every present and future screen under `/matters/*` and `/assessments/*` with no per-page opt-in.

## Task Commits

1. **Task 1: `statementVersion` — the capability statement re-shows itself** - `cef5ce1` (feat)
2. **Task 2: `StatusStrip` — additive AC-31 cells** - `89342a2` (feat)
3. **Task 3: Mount the gate at the layout, thread the strip's two new props** - `07cf290` (feat)

_No separate plan-metadata commit — STATE.md/ROADMAP.md/REQUIREMENTS.md updated in the phase-level closeout commit per this worktree's established gsd-tools-unavailable convention._

## Files Created/Modified

- `apps/web/src/ui/capability/capability-statement.tsx` — `CAPABILITY_STATEMENT_VERSION`, version-comparison ack
- `apps/web/src/ui/capability/capability-statement.test.tsx` — 6 new tests
- `apps/web/src/ui/chrome/status-strip.tsx` — `reviewedOn`, `daysUntilReviewDue` props and tri-state derivation
- `apps/web/src/ui/chrome/status-strip.test.tsx` — 6 new tests
- `apps/web/src/ui/honesty.test.tsx` — updated call site (Rule 3)
- `apps/web/app/(hr)/layout.tsx`, `apps/web/app/(legal)/layout.tsx` — now wrap `children` in `CapabilityStatement`
- `apps/web/app/(hr)/layout.test.tsx`, `apps/web/app/(legal)/layout.test.tsx` — new, prove the gate is real
- `apps/web/app/(legal)/assessments/[id]/page.tsx` — threads the two new `StatusStrip` props from a shared `now`

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking fix] `apps/web/src/ui/honesty.test.tsx` needed the two new `StatusStrip` props**

- **Found during:** Task 2 verification (`pnpm run typecheck`)
- **Issue:** This pre-existing test file (not in this plan's declared `files_modified` list) constructs a `StatusStrip` directly and failed to typecheck once the two new props became required.
- **Fix:** Added `reviewedOn: null, daysUntilReviewDue: 400` to the existing call, matching the same neutral fixture values used elsewhere in this plan.
- **Files modified:** `apps/web/src/ui/honesty.test.tsx`
- **Verification:** `pnpm run typecheck` exits 0; `pnpm test` full suite green.
- **Committed in:** `89342a2` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary for correctness — this typecheck failure was the plan's own intended forcing function extended to one additional pre-existing call site the plan's file list didn't anticipate. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`jurisdiction-packs.ts` (Plan 05-03) can now compose the reconciled `StatusStrip` onto new HR screens using this exact shape. Full suite: 746/746 passing (up from the 732/732 baseline), lint/typecheck/depcruise all clean.
