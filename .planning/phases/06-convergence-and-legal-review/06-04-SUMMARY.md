---
phase: 06-convergence-and-legal-review
plan: 04
subsystem: routing
tags: [next.js, app-router, routing]

requires:
  - phase: 06-01
    provides: no direct dependency, but sequenced after per depends_on
provides:
  - "Real /hr/* and /legal/* URL segments (route groups replaced)"
  - "/legal/queue at NAV-01's own literal path"
affects: [06-06, 06-08, 06-09]

actuals:
  tokens: 5064
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Before/after grep-count proof (getCurrentActor/requireRole occurrence count, identical pre- and post-move) as the standing verification pattern for any future file move touching a page.tsx"

key-files:
  created:
    - apps/web/app/hr/layout.tsx
    - apps/web/app/legal/layout.tsx
    - "apps/web/app/legal/queue/page.tsx"
  modified:
    - "apps/web/app/hr/matters/page.tsx"
    - "apps/web/app/hr/matters/new/page.tsx"
    - "apps/web/app/hr/matters/[id]/page.tsx"
    - "apps/web/app/hr/matters/[id]/submitted/page.tsx"
    - "apps/web/app/legal/assessments/[id]/page.tsx"
    - apps/web/app/page.tsx
    - apps/web/src/ui/intake/intake-form.tsx
    - tests/routes/hr-matters-list.test.ts
    - tests/routes/live-routing.test.ts

key-decisions:
  - "The landing page's legal-side link text changed from \"Open an assessment, as Legal\" to \"Open the legal queue\" — more honest against the new /legal/queue destination; no test asserted the old literal text"
  - "Before/after getCurrentActor/requireRole grep counts recorded and verified identical for all six moved page.tsx files (2, 0, 2, 4, 3, 2) before considering the move complete — per this project's own three-times-repeated authorization-gap bug class"

requirements-completed: [NAV-01]

coverage:
  - id: D1
    description: "Every HR page reachable at a real /hr/* URL, every legal page at a real /legal/* URL, not a route group"
    requirement: NAV-01
    verification:
      - kind: unit
        ref: "tests/routes/live-routing.test.ts#LIVE-ROUTING: hr/legal are real, reachable path segments"
        status: pass
    human_judgment: false
  - id: D2
    description: "The legal worklist is reachable at the literal path /legal/queue"
    requirement: NAV-01
    verification:
      - kind: unit
        ref: "apps/web/app/legal/queue/page.tsx (file location) + tests/routes/live-routing.test.ts positive-usage assertion"
        status: pass
    human_judgment: false
  - id: D3
    description: "No moved page.tsx lost its authorization gate during the move"
    verification:
      - kind: manual_procedural
        ref: "before/after grep -c \"getCurrentActor|requireRole\" count comparison across all six moved page.tsx files, identical in both counts"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 4: Route Restructuring — Real /hr, /legal Segments Summary

**Replaced the `(hr)`/`(legal)` Next.js route groups — which contributed no URL segment — with real `hr`/`legal` path segments via `git mv`, relocated the legal worklist to `/legal/queue` (NAV-01's literal path), and updated every internal link/navigation call to its new destination.**

## Performance

- **Duration:** 35 min
- **Tasks:** 2
- **Files modified:** 16 (10 renamed, 6 content-only)

## Accomplishments
- Ten files moved via `git mv` (history preserved, confirmed by `git status --find-renames=30%` showing all ten as `R`): `apps/web/app/(hr)/**` → `apps/web/app/hr/**`, `apps/web/app/(legal)/**` → `apps/web/app/legal/**`, with `assessments/page.tsx` specifically relocated to `apps/web/app/legal/queue/page.tsx`
- Every internal `href`/`router.push` reference updated to its new real destination (landing page, HR matters list, intake form's post-submit redirect, the queue page's own link into `/legal/assessments/{id}`)
- Before/after `getCurrentActor`/`requireRole` occurrence counts verified identical across all six moved `page.tsx` files (2, 0, 2, 4, 3, 2 respectively, unchanged) — no page's authorization behavior changed as a side effect of the move
- `tests/routes/live-routing.test.ts`'s obsolete "no dead route-group links" test (whose entire premise is now false) replaced with a positive proof; `tests/routes/hr-matters-list.test.ts` updated to import and assert against the real new path
- Full `pnpm test` suite: 862 → 863 passing (net +1: live-routing gained 2 tests, lost 1 obsolete one), zero regressions

## Task Commits

1. **Task 1: Move (hr) -> hr and (legal) -> legal, relocate the worklist to /legal/queue** - `86af46c` (feat)
2. **Task 2: Fix the two tests whose meaning the restructuring changes** - `a8b77ee` (fix)

## Files Created/Modified
- `apps/web/app/hr/layout.tsx`, `apps/web/app/legal/layout.tsx` - moved, header comments corrected to name the new real path
- `apps/web/app/hr/matters/page.tsx` - moved, two hrefs updated to `/hr/matters/...`
- `apps/web/app/hr/matters/new/page.tsx`, `apps/web/app/hr/matters/[id]/page.tsx`, `apps/web/app/hr/matters/[id]/submitted/page.tsx` - moved, header comments only (no href changes needed)
- `apps/web/app/legal/assessments/[id]/page.tsx` - moved, header comment only
- `apps/web/app/legal/queue/page.tsx` - moved from `assessments/page.tsx`, one href updated to `/legal/assessments/{id}`; content otherwise unchanged (06-06's job)
- `apps/web/app/page.tsx` - both entry links updated to their new real destinations
- `apps/web/src/ui/intake/intake-form.tsx` - `router.push` destination updated
- `tests/routes/hr-matters-list.test.ts` - page path and two href assertions updated
- `tests/routes/live-routing.test.ts` - obsolete describe block replaced with a positive proof (old directories gone + new prefix actually used)

## Decisions Made
- Landing page's legal-side link text changed from "Open an assessment, as Legal" to "Open the legal queue" (plan's own explicit discretion) — more honest against the new `/legal/queue` destination; confirmed no test asserts the old literal text before changing it
- Confirmed via exhaustive grep sweep (`grep -rn '"/matters\|`/matters\|"/assessments\|`/assessments' apps/web/app apps/web/src`) that zero page-route references to the old unprefixed paths remain anywhere in `apps/web`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None. The `git status` default similarity threshold initially displayed the two `layout.tsx` files as delete+add rather than rename (their header-comment edits changed a large fraction of a very small file) — confirmed via `git status --find-renames=30%` that git's underlying content-similarity detection still correctly identifies them as renames; this is a cosmetic default-threshold artifact, not a history-preservation gap (`git mv` was used for every file, and the object database's blob history is unaffected by which similarity threshold `git status` happens to report at).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
`/legal/queue` now exists as a real, reachable path — Plan 06-06 (Wave 3) can now add its richer behavior (sorting, `INFO_REQUEST` inclusion) to this exact file without needing to relocate it first. No blockers for 06-05 (parallel within Wave 2) or 06-06.

## Self-Check: PASSED

- FOUND: apps/web/app/hr/layout.tsx
- FOUND: apps/web/app/legal/layout.tsx
- FOUND: apps/web/app/legal/queue/page.tsx
- FOUND commit: 86af46c
- FOUND commit: a8b77ee

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
