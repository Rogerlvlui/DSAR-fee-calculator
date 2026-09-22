---
phase: 06-convergence-and-legal-review
plan: 06
subsystem: ui
tags: [next.js, queue, sorting, advisory-deadline]

requires:
  - phase: 06-04
    provides: "/legal/queue as a real, reachable path"
provides:
  - Widened listReviewableMatters (INFO_REQUEST, CLOSED included)
  - Pure sortQueueRows comparator (apps/web/src/domain/queue-sort.ts)
  - "/legal/queue sort toggle + advisory-deadline rendering"
affects: [06-08, 06-09]

actuals:
  tokens: 5401
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Sort mode as a URL search param on a server component — a toggle reachable with no client-side JavaScript, consistent with this app's default server-rendered pages"

key-files:
  created:
    - apps/web/src/domain/queue-sort.ts
    - tests/routes/legal-queue.test.ts
  modified:
    - apps/web/src/server/data/matters.ts
    - "apps/web/app/legal/queue/page.tsx"

key-decisions:
  - "listReviewableMatters widened via a named REVIEWABLE_MATTER_STATUSES set rather than a longer OR chain — matches this codebase's own established named-constant-set precedent"
  - "Sort toggle read from a searchParams Promise (Next 15+/16 async-params convention already used for params elsewhere in this codebase), defaulting to DEADLINE_SOONEST for any absent or unrecognised value — never throws, never silently reveals a different matter set"
  - "Legal-queue fixture matters driven through the real createMatter/addExpenseLine/submitForAssessment pipeline, not a bare status-field mutation — listReviewableMatters only includes a matter with a real persisted assessment, so a status-only mutation without ever submitting would never actually appear in the queue"

requirements-completed: [NAV-01]

coverage:
  - id: D1
    description: "/legal/queue lists LEGAL_REVIEW and INFO_REQUEST matters (plus the pre-existing SIGNED_OFF/CLOSED), sortable by deadline or age, with no SLA colouring"
    requirement: NAV-01
    verification:
      - kind: unit
        ref: "apps/web/src/domain/queue-sort.test.ts (4 tests)"
        status: pass
      - kind: integration
        ref: "tests/routes/legal-queue.test.ts#LEGAL-QUEUE (5 tests)"
        status: pass
      - kind: integration
        ref: "tests/routes/assessments-list.test.ts#listReviewableMatters: 06-06 widening"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 6: Legal Queue — Widened Statuses + Sort Toggle Summary

**`listReviewableMatters` now surfaces `INFO_REQUEST` and `CLOSED` matters alongside the pre-existing `LEGAL_REVIEW`/`SIGNED_OFF` ones; `/legal/queue` renders a deadline-soonest/oldest-first sort toggle (URL search param, no client JS) backed by a new pure `sortQueueRows` comparator, with the UI-SPEC's exact three-way status label mapping and no SLA colouring anywhere.**

## Performance

- **Duration:** 40 min
- **Tasks:** 2
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments
- `listReviewableMatters` widened from a two-status OR check to a named `REVIEWABLE_MATTER_STATUSES` set including `INFO_REQUEST` and `CLOSED`; `DRAFT`/`COMPUTING` remain excluded, proven by a dedicated regression test
- New `apps/web/src/domain/queue-sort.ts`: pure `sortQueueRows` for `DEADLINE_SOONEST` (resolvable rows by ascending `daysRemaining`, unresolvable rows after, by age) and `OLDEST_FIRST` (age only) — never throws, never mutates its input
- `/legal/queue` now reads its sort mode from `?sort=oldest`/absent-defaults-to-deadline-soonest, resolves each row's advisory deadline via the existing `computeAdvisoryDeadline`, and renders the UI-SPEC's exact row status labels ("Awaiting review" / "Awaiting HR reply" / "Signed off") plus the sort toggle with `aria-current="true"` and an underline class on the active option — no colour-only signal anywhere
- `getCurrentActor`/`requireRole` call-site count on the page confirmed unchanged (3, before and after) — the widened read is the same already-gated function, never duplicated
- Full `pnpm test` suite: 877 → 887 passing (10 new), zero regressions

## Task Commits

1. **Task 1: listReviewableMatters widened, and the pure sort comparator** - `9185091` (feat)
2. **Task 2: Wire the sort toggle and the INFO_REQUEST row label onto /legal/queue** - `c104ab9` (feat)

## Files Created/Modified
- `apps/web/src/server/data/matters.ts` - `listReviewableMatters` widened via `REVIEWABLE_MATTER_STATUSES`
- `apps/web/src/domain/queue-sort.ts` / `.test.ts` - new pure comparator module, 4 tests
- `apps/web/app/legal/queue/page.tsx` - sort toggle, widened row status labels, advisory-deadline rendering
- `tests/routes/legal-queue.test.ts` - new, 5 tests
- `tests/routes/assessments-list.test.ts` - 1 new widening-regression test

## Decisions Made
- `REVIEWABLE_MATTER_STATUSES` is a named `Set` constant, not an inline OR chain — matches this codebase's own established named-constant precedent (e.g. `HR_VISIBLE_MATTER_STATUSES` in the same file)
- Sort mode read via `searchParams: Promise<{ sort?: string }>`, following this codebase's existing async-`params` convention for dynamic segments — a server component reading a search param needs no new client-side state or JavaScript
- Per 06-RESEARCH.md's own note (recorded in the plan's `read_first`): "for the lawyer's jurisdiction" in NAV-01's roadmap framing is PRD-level language this prototype's single stubbed `LEGAL_REVIEWER` identity does not model — no jurisdiction-scoping mechanism was invented; every reviewable matter across all jurisdictions appears in the one queue, matching this prototype's existing single-identity framing throughout (ACCESS-06 precedent)

## Deviations from Plan

None - plan executed exactly as written. One necessary test-construction correction during Task 2's own verification (not a deviation from the plan's specified behavior, but from an initial, incorrect test fixture approach):

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixture matters needed a real submitted assessment, not a bare status mutation**
- **Found during:** Task 2 (writing tests/routes/legal-queue.test.ts)
- **Issue:** An initial test draft created a matter and mutated its `status` field directly via the repository without ever running it through `submitForAssessment` — `listReviewableMatters` only includes a matter that ALSO has a real persisted assessment (`getAssessmentByMatterId`), so the mutated-status-only matter never actually appeared in query results, and three tests failed on "expected -1 to be greater than -1" (reference string never found)
- **Fix:** Rewrote the fixture builder to drive matters through the real `createMatter`/`addExpenseLine`/`submitForAssessment` pipeline, then (only for the `INFO_REQUEST` case) mutate the already-submitted matter's status
- **Files modified:** tests/routes/legal-queue.test.ts
- **Verification:** All 5 LEGAL-QUEUE tests pass
- **Committed in:** c104ab9 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (test-construction correction, no production-code scope creep)
**Impact on plan:** None on delivered behavior.

## Issues Encountered
None beyond the fixture-construction correction above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
NAV-01 is fully discharged. Wave 4's keyboard-navigation plan (06-08) can add `/legal/queue`'s own keyboard shortcuts against this now-stable page structure. No blockers.

## Self-Check: PASSED

- FOUND: apps/web/src/domain/queue-sort.ts
- FOUND: apps/web/app/legal/queue/page.tsx
- FOUND commit: 9185091
- FOUND commit: c104ab9

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
