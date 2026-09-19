---
phase: 05-hr-intake-and-disclosure-shell
plan: 05
subsystem: intake-autosave
tags: [react, localstorage, timers, hooks]

# Dependency graph
requires:
  - phase: 05-hr-intake-and-disclosure-shell (05-03)
    provides: "intake-form.tsx's existing composition point (StatusStrip) this plan renders alongside"
provides:
  - "writeDraftToStorage, useDraftAutosave, AutosaveState, AutosaveStatus — new exports from use-draft-autosave.ts"
  - "AutosaveIndicator — new presentational component"
  - "INTAKE_DRAFT_STORAGE_KEY — the named autosave storage key"
affects: []

# Actuals (#2632)
actuals:
  tokens: 4092
  tasks: 2
  commits: 2
  plan_head_before: 09a3eded33ac4095fd04bed6b3023d73b0b1bae0

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A timer-driven React effect is tested with vi.useFakeTimers() + react-dom/client's createRoot inside act (both ship with react/react-dom already) — no new test-only dependency, and a microtask boundary (Promise.resolve()) between two state updates keeps an intermediate status genuinely observable rather than collapsed by React's automatic batching"

key-files:
  created:
    - apps/web/src/ui/intake/use-draft-autosave.ts
    - apps/web/src/ui/intake/use-draft-autosave.test.ts
    - apps/web/src/ui/intake/autosave-indicator.tsx
    - apps/web/src/ui/intake/autosave-indicator.test.tsx
  modified:
    - apps/web/src/ui/intake/intake-form.tsx
    - apps/web/src/ui/intake/intake-form.test.tsx

key-decisions:
  - "No restore-on-reload — the literal requirement is \"autosave every 10 seconds with save state shown\"; PROJECT.md's no-server-persisted-drafts boundary plus this codebase's total absence of any restore pattern both support keeping this minimal"
  - "\"saving\" and \"idle\" render identically in AutosaveIndicator — a first-time viewer gains nothing from distinguishing the two"
  - "AutosaveIndicator renders ABOVE StatusStrip as the very first child (05-05 supersedes 05-03's own \"StatusStrip first\" instruction for this one call site, since 05-05 runs later and depends on 05-03)"

requirements-completed: [INTAKE-09]

coverage:
  - id: D1
    description: "The intake form writes its current draft to browser storage every 10 seconds while it is open, and a visible indicator reads Saving/Saved/Save failed in step with that cadence — no server round-trip, no restore-on-reload"
    requirement: "INTAKE-09"
    verification:
      - kind: unit
        ref: "apps/web/src/ui/intake/use-draft-autosave.test.ts#use-draft-autosave — 7 tests: pure storage mechanism (2), idle/saved/stale-closure/error/unmount-clears-interval timer-driven cases (5)"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/intake/autosave-indicator.test.tsx#AUTOSAVE-INDICATOR — 4 tests over all three copy states, relative-time formatting with a fixed now"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/intake/intake-form.test.tsx#INTAKE-FORM: autosave indicator — 2 tests: first-child position, storage-key constant"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-09-20
status: complete
---

# Phase 5 Plan 5: Draft Autosave Summary

**`useDraftAutosave` gives the intake form a genuinely testable 10-second client-local autosave cycle — a real, observable "saving" state (not collapsed by React batching), a stale-closure-free write of the LATEST value, and a visible `AutosaveIndicator` wired in as the form's first element.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 2 completed
- **Files modified:** 6 (4 created, 2 modified)

## Accomplishments

- `writeDraftToStorage` is a pure, total function — never throws on a full or disabled `localStorage`.
- `useDraftAutosave` proves (via `vi.useFakeTimers()` + a real mounted component) a full saving→saved cycle, a stale-closure-free write of a changed value, a genuine error state on a failing write, and interval cleanup on unmount.
- `AutosaveIndicator` renders the UI-SPEC's three verbatim copy strings and is now the first element inside the intake form.

## Task Commits

1. **Task 1: `writeDraftToStorage` and `useDraftAutosave`** - `214b4ec` (feat)
2. **Task 2: `AutosaveIndicator`, wired into the intake form** - `1ad5545` (feat)

## Files Created/Modified

- `apps/web/src/ui/intake/use-draft-autosave.ts` / `.test.ts` — new
- `apps/web/src/ui/intake/autosave-indicator.tsx` / `.test.tsx` — new
- `apps/web/src/ui/intake/intake-form.tsx` — `INTAKE_DRAFT_STORAGE_KEY`, `useDraftAutosave` call, `AutosaveIndicator` composed
- `apps/web/src/ui/intake/intake-form.test.tsx` — 2 new tests

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

A TypeScript `exactOptionalPropertyTypes` error surfaced in `autosave-indicator.test.tsx`'s own helper (an explicit `now: undefined` is not assignable to an optional `number` prop under that compiler flag) — fixed by conditionally omitting the `now` key rather than passing it as `undefined`. No production code change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 3 (05-04, 05-05) is complete. Wave 4's closing plan (05-06) depends on all five prior plans and can now scan every new surface. Full suite: 816/816 passing, lint/typecheck/depcruise all clean.
