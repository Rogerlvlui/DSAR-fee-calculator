---
phase: 05-hr-intake-and-disclosure-shell
plan: 04
subsystem: hr-worklist
tags: [react, next-app-router, role-scoped-read, leak-channel-boundary]

# Dependency graph
requires:
  - phase: 05-hr-intake-and-disclosure-shell (05-03)
    provides: "buildJurisdictionPackViews — per-jurisdiction constraints this plan's advisory-deadline computation reads"
provides:
  - "apps/web/src/domain/advisory-deadline.ts — the one shared home for the advisory-deadline date arithmetic (addDaysToIsoDate, computeAdvisoryDeadline, AdvisoryDeadlineView, ADVISORY_QUALIFIER)"
  - "listMattersForPreparer, matterStatusLabelForHr — new exports"
  - "apps/web/app/(hr)/matters/page.tsx — the NAV-02 list screen"
affects: [06-convergence-and-legal-review]

# Actuals (#2632)
actuals:
  tokens: 6774
  tasks: 3
  commits: 3
  plan_head_before: 1b5800347ddb7b5190cfea277d6f4661957f49b3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A page that must call getCurrentActor() (next/headers' cookies()) is loaded via a runtime-computed dynamic import in its own test, not a static import statement — sidesteps both the 'outside a request scope' runtime error (mocked away with vi.mock) and tests/tsconfig.json's deliberate exclusion of next/headers-importing files under nodenext resolution"
    - "An exhaustive, no-default Record<ClosedUnion, string> lookup is the pattern for a leak-channel-boundary label collapse — a future addition to the closed set is a compile error here, not a silent UI leak"

key-files:
  created:
    - apps/web/src/domain/advisory-deadline.ts
    - apps/web/src/domain/advisory-deadline.test.ts
    - apps/web/src/domain/hr-matter-status-label.ts
    - apps/web/src/domain/hr-matter-status-label.test.ts
    - "apps/web/app/(hr)/matters/page.tsx"
    - tests/routes/list-matters-for-preparer.test.ts
    - tests/routes/hr-matters-list.test.ts
  modified:
    - apps/web/src/server/review-view.ts
    - apps/web/src/ui/review/matter-rail.tsx
    - apps/web/src/server/data/matters.ts

key-decisions:
  - "\"The preparer's own matters\" means literally createdBy.id === actor.user.id (05-RESEARCH.md Assumption A2's literal reading, not a team-wide one)"
  - "SUPERSEDED collapses into the same \"Sent to Legal\" bucket as the three other in-flight statuses — not explicitly named in the plan's own three-bucket description, but the only consistent reading of \"HR must never learn which in-flight stage\" applied to a fourth in-flight-adjacent status; documented in the module's own header comment rather than left as a silent gap"
  - "/matters carries no StatusStrip — a cross-jurisdiction worklist has no single jurisdiction/pack to show, per Plan 05-03's own established assumption"
  - "A matter whose pack yields no advisory deadline renders no deadline row at all, matching MatterRail's own existing null-means-nothing behavior"

requirements-completed: [NAV-02, DISC-05]

coverage:
  - id: D1
    description: "/matters lists only the matters the current preparer created, each with a collapsed status label that never reveals which of COMPUTING/LEGAL_REVIEW/INFO_REQUEST the matter is in, and its own advisory deadline in a container carrying the word 'Advisory'"
    requirement: "NAV-02"
    verification:
      - kind: integration
        ref: "tests/routes/list-matters-for-preparer.test.ts — role refusal + ownership filter proven against two distinct hand-constructed actors"
        status: pass
      - kind: integration
        ref: "tests/routes/hr-matters-list.test.ts#hr-matters-list — 4 tests: empty state, advisory-deadline-present row, advisory-deadline-absent row, correct /matters/{id} link"
        status: pass
      - kind: unit
        ref: "apps/web/src/domain/hr-matter-status-label.test.ts — exhaustive, no-default Record proven over all seven MatterStatus values"
        status: pass
    human_judgment: false
  - id: D2
    description: "The advisory-deadline date arithmetic exists in exactly one place, shared by the legal review page's existing MatterRail and this new list, never two copies that could drift"
    requirement: "DISC-05"
    verification:
      - kind: unit
        ref: "apps/web/src/domain/advisory-deadline.test.ts#ADVISORY-DEADLINE — 6 tests including a byte-identical regression check against review-view.ts's pre-extraction fixture values"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-20
status: complete
---

# Phase 5 Plan 4: HR Matters List Summary

**`/matters` gives HR an in-app worklist of the matters they created — the substitute NS-3's ban on outbound email requires — reusing the advisory-deadline calculation newly extracted from the legal review page's `MatterRail` into one shared `apps/web/src/domain/advisory-deadline.ts` module.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 completed
- **Files modified:** 10 (7 created, 3 modified)

## Accomplishments

- `addDaysToIsoDate`/`computeAdvisoryDeadline`/`AdvisoryDeadlineView`/`ADVISORY_QUALIFIER` now live in exactly one place (`apps/web/src/domain/advisory-deadline.ts`), a pure relocation with a byte-identical regression test proving no behavior changed.
- `listMattersForPreparer` mirrors `listReviewableMatters`'s exact role-checked-DAL shape; `matterStatusLabelForHr` is an exhaustive, no-default lookup collapsing `MatterStatus`'s seven values to three HR-facing buckets.
- `/matters` renders the preparer's own worklist with a collapsed status label and, where the jurisdiction's pack yields one, an honestly-computed advisory deadline — reading no `Assessment` anywhere.

## Task Commits

1. **Task 1: Extract the advisory-deadline math into one shared, non-server-only module** - `8c89a18` (refactor)
2. **Task 2: `listMattersForPreparer` and the collapsed HR-facing status label** - `2505ca3` (feat)
3. **Task 3: `/matters` — the list screen itself** - `c14c789` (feat)

## Files Created/Modified

- `apps/web/src/domain/advisory-deadline.ts` / `.test.ts` — the one shared home for this date arithmetic
- `apps/web/src/server/review-view.ts` — imports from the new module instead of declaring its own copies
- `apps/web/src/ui/review/matter-rail.tsx` — imports `ADVISORY_QUALIFIER`, keeps its own type re-declaration
- `apps/web/src/domain/hr-matter-status-label.ts` / `.test.ts` — new
- `apps/web/src/server/data/matters.ts` — `listMattersForPreparer`
- `apps/web/app/(hr)/matters/page.tsx` — the NAV-02 list screen
- `tests/routes/list-matters-for-preparer.test.ts`, `tests/routes/hr-matters-list.test.ts` — new

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `next/headers`' `cookies()` throws outside a request scope when the page is rendered directly in a test**

- **Found during:** Task 3 verification
- **Issue:** `HrMattersListPage`'s `getCurrentActor()` call throws "called outside a request scope" when the page's default export is invoked as a plain function, with no real Next.js request context — the plan's own instruction to "call the page's default export directly" did not anticipate this.
- **Fix:** `vi.mock("next/headers", ...)` in the test file, resolving to an empty cookie jar (the same default `resolveActorFromCookieHeader(null)` already returns).
- **Files modified:** `tests/routes/hr-matters-list.test.ts`
- **Verification:** All 4 tests pass.
- **Committed in:** `c14c789` (part of Task 3's commit)

**2. [Rule 3 - Blocking fix] Static import of `page.tsx` fails `tsc --build`'s project file-list check**

- **Found during:** Task 3 verification (`pnpm run typecheck`)
- **Issue:** `tests/tsconfig.json`'s `include` list deliberately excludes page.tsx files and `current-actor.ts` (its `next/headers` import does not resolve under this project's `nodenext` resolution). A static `import` of the new page module tripped both TS6307 (file not listed) and, transitively, TS2307 (module not found) for `current-actor.ts`.
- **Fix:** Loaded the page module via a runtime-computed dynamic `import()` (path built with `path.join`, not a string literal) — invisible to `tsc`'s static project file-list check, matching `tests/boundary/dom-denylist.test.ts`'s own glob-half technique.
- **Files modified:** `tests/routes/hr-matters-list.test.ts`
- **Verification:** `pnpm run typecheck` exits 0; full suite green.
- **Committed in:** `c14c789` (part of Task 3's commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** Both necessary to make the plan's own instructed test technique actually work under this codebase's existing tsconfig boundaries. No scope creep.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Wave 3's second plan (05-05, autosave) also depends only on 05-03 and can proceed independently. Full suite: 803/803 passing, lint/typecheck/depcruise all clean.
