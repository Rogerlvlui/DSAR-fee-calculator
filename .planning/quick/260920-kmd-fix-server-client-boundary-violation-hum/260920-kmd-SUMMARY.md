---
phase: 260920-kmd
plan: 01
subsystem: apps/web (server/client boundary)
tags: [bugfix, rsc-boundary, dependency-cruiser-adjacent]
status: complete
dependency-graph:
  requires: []
  provides:
    - apps/web/src/domain/pack-display-status.ts
    - apps/web/src/domain/recompute-banner.ts
    - tests/boundary/server-client-boundary.test.ts
  affects:
    - apps/web/src/ui/intake/matter-details-fields.tsx
    - apps/web/src/ui/intake/intake-form.tsx
    - apps/web/src/ui/review/recompute-confirm.tsx
    - apps/web/app/hr/matters/[id]/page.tsx
    - apps/web/app/hr/matters/[id]/submitted/page.tsx
    - apps/web/app/legal/assessments/[id]/page.tsx
tech-stack:
  added: []
  patterns:
    - "Pure server/client-shared helpers live under apps/web/src/domain/, never inside a \"use client\" file, mirroring the pre-existing hr-matter-status-label.ts precedent"
key-files:
  created:
    - apps/web/src/domain/pack-display-status.ts
    - apps/web/src/domain/pack-display-status.test.ts
    - apps/web/src/domain/recompute-banner.ts
    - apps/web/src/domain/recompute-banner.test.ts
    - tests/boundary/server-client-boundary.test.ts
  modified:
    - apps/web/src/ui/intake/matter-details-fields.tsx
    - apps/web/src/ui/intake/matter-details-fields.test.tsx
    - apps/web/src/ui/intake/intake-form.tsx
    - apps/web/src/ui/review/recompute-confirm.tsx
    - apps/web/src/ui/review/recompute-confirm.test.tsx
    - apps/web/app/hr/matters/[id]/page.tsx
    - apps/web/app/hr/matters/[id]/submitted/page.tsx
    - apps/web/app/legal/assessments/[id]/page.tsx
decisions:
  - "Second violation found during planning (legal review screen, shouldRenderRecomputeBanner) fixed in this same task alongside the reported bug — same bug class, same fix pattern, would have crashed on first open otherwise"
  - "No re-export shim left in either client module, per this project's established 'delete the stand-in and update callers' precedent (Phase 04 P04's state.ts, Phase 05's pack-view.ts)"
  - "Regression gate's directive detection strips leading comments/whitespace and checks the file's first real statement, rather than a naive substring search for \"import\"/\"use client\" — several of this codebase's own header comments already contain both words in prose, which a naive substring approach would misclassify"
metrics:
  duration: ~45min
  completed: 2026-09-20
actuals:
  tokens: 11334
  tasks: 3
  commits: 3
  plan_head_before: df62981
---

# Phase 260920-kmd Plan 01: Fix server/client boundary violation Summary

Relocated two pure helper functions (`humanizePackDisplayStatus`,
`shouldRenderRecomputeBanner`) out of `"use client"` modules into plain
`apps/web/src/domain/` modules, fixing a live crash on `/hr/matters/[id]/submitted`
and an identical, not-yet-reported crash on `/legal/assessments/[id]`, then added a
source-scanning regression gate so this bug class can't recur silently.

## What Was Built

**Task 1 — `humanizePackDisplayStatus` relocation.** Moved the function and its
`MatterDetailsJurisdictionPackDisplayStatus` type from
`apps/web/src/ui/intake/matter-details-fields.tsx` (a `"use client"` module) to a
new `apps/web/src/domain/pack-display-status.ts`, mirroring the existing
`hr-matter-status-label.ts` precedent. Repointed all five import sites (two HR
`page.tsx` files, `intake-form.tsx`, `matter-details-fields.tsx` itself for the
type, and the test file). Moved the three existing tests into a new
`pack-display-status.test.ts`, retagged `PACK-DISPLAY-STATUS`. No output string or
logic changed.

**Task 2 — Second violation found during planning, fixed the same way.** While
reading `apps/web/app/legal/assessments/[id]/page.tsx` for context, found it also
unconditionally calls `shouldRenderRecomputeBanner(...)`, imported from
`apps/web/src/ui/review/recompute-confirm.tsx` — which carries `"use client"`. This
is the identical defect class on the legal review screen, live and would have
thrown the same error the first time that page was opened (no existing test
covers it — every route test drives handlers directly, bypassing real page
rendering). Moved the function to a new `apps/web/src/domain/recompute-banner.ts`.
The page still imports `RecomputeConfirm` (a component) from the client module —
only the function call crosses the boundary now. Moved the two gating tests into
`recompute-banner.test.ts`, retagged `RECOMPUTE-BANNER`.

**Task 3 — Regression gate.** Added
`tests/boundary/server-client-boundary.test.ts`: a source-scanning gate that walks
every `.ts`/`.tsx` file under `apps/web/app`, treats a file as server-side when it
carries no client directive as its first real statement, and for each relative
import resolving to a file that DOES carry the directive, flags any non-type,
non-component (lowercase-named) binding. Proven both against the real
`apps/web/app` tree (zero violations) and a synthetic `mkdtemp` fixture (exactly
one detected violation, naming the offending binding) — the positive control that
stops the gate passing vacuously if the walker silently found no files.

## Deviations from Plan

### Auto-fixed Issues

None beyond what the plan itself already scoped (the second violation was
explicitly planned as part of Task 2, not an in-flight discovery during
execution).

**1. [Rule 1 — correctness] Directive-detection implementation deviates from the
plan's literal wording, same intent.** The plan's Task 3 action text describes
computing "the index of the first `import` occurrence" and searching for the
directive only in the text before it. A literal implementation of that would
misclassify files whose header comments contain the word "import" in prose before
the real `"use client"` directive or first `import` statement — several files in
this codebase do (e.g. `intake-form.tsx`'s header comment: "...import nothing from
apps/web/src/server..."). Implemented instead by stripping leading
comments/whitespace and checking whether `"use client"` is the file's first real
statement — the same rule React/Next.js itself enforces for the directive to take
effect, and immune to the prose-collision false negative. Verified correct against
both the real tree and the synthetic fixture. Documented in the test file's own
header comment.

## Auth Gates

None encountered.

## Known Stubs

None.

## Threat Flags

None — both relocated functions are pure mappers over an enum and version
strings; the threat model's own `<accept>` disposition (T-kmd-01) covers this and
nothing new is introduced.

## Verification

All four commands from the plan's `<verification>` block ran clean after all
three tasks:

- `pnpm typecheck` — clean
- `pnpm lint` — clean
- `pnpm depcruise` — clean (361 modules, 692 dependencies cruised, no violations;
  confirmed the new `apps/web/src/domain/` modules trip no existing dependency-cruiser
  rule)
- `pnpm vitest run` — 949 tests passed across 117 files, 0 failed

Per-task named filters (`PACK-DISPLAY-STATUS`, `MATTER-DETAILS`, `INTAKE-FORM`,
`RECOMPUTE-BANNER`, `RECOMPUTE-CONFIRM`, `SERVER-CLIENT-BOUNDARY`) all green
individually before the full-suite run.

## Self-Check: PASSED

- FOUND: apps/web/src/domain/pack-display-status.ts
- FOUND: apps/web/src/domain/pack-display-status.test.ts
- FOUND: apps/web/src/domain/recompute-banner.ts
- FOUND: apps/web/src/domain/recompute-banner.test.ts
- FOUND: tests/boundary/server-client-boundary.test.ts
- FOUND commit a4f4df7 (Task 1)
- FOUND commit f903666 (Task 2)
- FOUND commit fbe7ce3 (Task 3)
