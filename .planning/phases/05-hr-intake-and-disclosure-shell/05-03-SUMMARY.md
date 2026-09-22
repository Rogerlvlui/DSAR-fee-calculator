---
phase: 05-hr-intake-and-disclosure-shell
plan: 03
subsystem: jurisdiction-pack-resolution
tags: [react, next-app-router, rule-packs, status-gating]

# Dependency graph
requires:
  - phase: 05-hr-intake-and-disclosure-shell (05-01)
    provides: "StatusStrip's reconciled AC-31 shape (reviewedOn, daysUntilReviewDue)"
  - phase: 03-rulepack-authoring
    provides: "packages/rulepacks/src/stale.ts (deriveEffectiveStatus, daysUntilReviewDue), stub-category-rules.ts's PACK_JURISDICTIONS table naming all nine jurisdictions"
provides:
  - "apps/web/src/server/jurisdiction-packs.ts — resolveJurisdictionPackViews (pure) + buildJurisdictionPackViews (IO), replacing pack-view.ts's SG-only resolution with all nine jurisdictions individually resolved"
  - "canOfferExpenseEntry (matter-details-fields.tsx) — the one exported predicate gating expense entry on a real per-jurisdiction posture"
  - "StatusStrip composed onto /matters/new (via IntakeForm), /matters/[id] and /matters/[id]/submitted"
affects: [05-hr-intake-and-disclosure-shell (05-04/05-05 depend on this plan), 06-convergence-and-legal-review]

# Actuals (#2632)
actuals:
  tokens: 12746
  tasks: 3
  commits: 3
  plan_head_before: 9218fbf414a9b9477a0446c43a7ec4a42f8e2fb1

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A UI-layer type (MatterDetailsJurisdictionPack, IntakeFormJurisdictionPackView) is a structurally identical re-declaration of a server-layer type, never an import (even type-only) — the established 03.1 precedent for the no-server-imports-in-ui dependency-cruiser rule, since the rule matches specifier text"
    - "A gating predicate (canOfferExpenseEntry) is exported from the component that owns the display-state derivation, so a caller (IntakeForm) never re-implements the posture check"

key-files:
  created:
    - apps/web/src/server/jurisdiction-packs.ts
    - apps/web/src/server/jurisdiction-packs.test.ts
    - apps/web/src/ui/intake/matter-details-fields.test.tsx
  modified:
    - apps/web/src/ui/intake/matter-details-fields.tsx
    - apps/web/src/ui/intake/intake-form.tsx
    - apps/web/src/ui/intake/intake-form.test.tsx
    - "apps/web/app/(hr)/matters/new/page.tsx"
    - "apps/web/app/(hr)/matters/[id]/page.tsx"
    - "apps/web/app/(hr)/matters/[id]/submitted/page.tsx"
    - tests/boundary/dom-denylist.test.ts
    - vitest.config.ts
  deleted:
    - apps/web/src/server/pack-view.ts

key-decisions:
  - "WITHDRAWN collapses into the same display bucket as DRAFT — no committed pack is ever WITHDRAWN today and no requirement names a sixth UI state"
  - "The intake screen's StatusStrip shows the live, not-yet-persisted draft reference — there is no created Matter row yet at that point in the flow"
  - "A daysUntilReviewDue of null (NO_USABLE_PACK) defaults to 9999 at every StatusStrip call site so an absent pack reads as unremarkable rather than alarming"
  - "Rule 3 auto-fix: vitest.config.ts's \"web\" project widened to admit .test.ts (not only .test.tsx) — jurisdiction-packs.test.ts has no other project home and overrides back to a node environment via a @vitest-environment docblock, since jsdom's window global trips server-only.ts's browser guard"

requirements-completed: [INTAKE-02, INTAKE-03, DISC-02]

coverage:
  - id: D1
    description: "Choosing any of the nine jurisdictions shows that jurisdiction's own real, uncoerced rule-pack status inline, immediately — never the SG-only hardcoded fallback"
    requirement: "INTAKE-02"
    verification:
      - kind: unit
        ref: "apps/web/src/server/jurisdiction-packs.test.ts#JURISDICTION-PACKS — 8 tests including the nine-key exact-match assertion and the defensive NO_USABLE_PACK branch proven against a hand-built missing-pack fixture"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/intake/matter-details-fields.test.tsx#MATTER-DETAILS — all five display states render their own copy"
        status: pass
    human_judgment: false
  - id: D2
    description: "A jurisdiction whose real posture is NO_EXPRESS_AUTHORITY/PROHIBITED, or whose pack cannot be resolved at all, withholds the expense-line repeater rather than merely warning alongside it"
    requirement: "INTAKE-03"
    verification:
      - kind: unit
        ref: "apps/web/src/ui/intake/intake-form.test.tsx#INTAKE-FORM: expense-entry gating — repeater absent for NO_USABLE_PACK and for PROHIBITED/NO_EXPRESS_AUTHORITY postures"
        status: pass
    human_judgment: false
  - id: D3
    description: "The status strip now appears on the intake screen, the HR result screen and the submitted confirmation, each showing that specific matter's own jurisdiction and pack"
    requirement: "DISC-02"
    verification:
      - kind: unit
        ref: "grep -rn StatusStrip across intake-form.tsx, matters/[id]/page.tsx, matters/[id]/submitted/page.tsx — all three call sites present"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-20
status: complete
---

# Phase 5 Plan 3: Real Nine-Jurisdiction Pack-Status Resolver Summary

**`jurisdiction-packs.ts` replaces Phase 3.1's SG-only hardcoded fallback with a real, individually-resolved status for all nine committed rule packs, `canOfferExpenseEntry` withholds the expense-line repeater instead of merely warning alongside it, and the reconciled `StatusStrip` is now composed onto every HR screen with a specific matter/jurisdiction in view.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed (Task 1 is a `type="tracer"` task — its own `<verify>` was re-run and passed before Task 2's expansion began)
- **Files modified:** 12 (3 created, 8 modified, 1 deleted)

## Accomplishments

- `resolveJurisdictionPackViews` (pure) and `buildJurisdictionPackViews` (the thin IO wrapper) resolve all nine jurisdictions from `PACK_JURISDICTIONS`, deriving each one's real `DRAFT`/`ACTIVE`/`ACTIVE_REVIEW_DUE_SOON`/`STALE`/`NO_USABLE_PACK` status via `@dsar/rulepacks/stale` — proven against a hand-built fixture missing one jurisdiction's pack so the defensive branch is real, not assumed.
- `canOfferExpenseEntry` is the single exported predicate `IntakeForm` uses to gate `ExpenseLineRepeater` — the actual INTAKE-03 fix, since the repeater previously rendered regardless of the resolved posture.
- `StatusStrip` is now composed onto `/matters/new` (via `IntakeForm`), `/matters/[id]` and `/matters/[id]/submitted` — every HR screen with a specific matter/jurisdiction in view now carries the same disclosure the legal review screen already had.

## Task Commits

1. **Task 1: `jurisdiction-packs.ts` — one real resolution across all nine jurisdictions** - `01da023` (feat)
2. **Task 2: The real gate — withhold expense entry, not just warn alongside it** - `baffa86` (feat)
3. **Task 3: `StatusStrip` composed onto the intake screen, the HR result screen and the submitted confirmation** - `06db43c` (feat)

## Files Created/Modified

- `apps/web/src/server/jurisdiction-packs.ts` — `JurisdictionPackView`, `resolveJurisdictionPackViews`, `buildJurisdictionPackViews`
- `apps/web/src/server/jurisdiction-packs.test.ts` — 8 tests
- `apps/web/src/server/pack-view.ts` — deleted, no re-export shim
- `apps/web/src/ui/intake/matter-details-fields.tsx` — `jurisdictionPack` prop, `canOfferExpenseEntry`, five-state readout
- `apps/web/src/ui/intake/matter-details-fields.test.tsx` — new, 9 tests
- `apps/web/src/ui/intake/intake-form.tsx` — `packsByJurisdiction` prop, real gating, `StatusStrip` composition
- `apps/web/src/ui/intake/intake-form.test.tsx` — 4 new tests
- `apps/web/app/(hr)/matters/new/page.tsx`, `[id]/page.tsx`, `[id]/submitted/page.tsx` — `buildJurisdictionPackViews()` wiring, `StatusStrip` composed
- `tests/boundary/dom-denylist.test.ts` — updated call site
- `vitest.config.ts` — "web" project glob widened to admit `.test.ts`

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking fix] `vitest.config.ts`'s "web" project could not find `jurisdiction-packs.test.ts`**

- **Found during:** Task 1 verification (`pnpm vitest run --project web -t "JURISDICTION-PACKS"` reported 0 tests)
- **Issue:** The "web" project's include glob was `apps/web/**/*.test.tsx` only — `jurisdiction-packs.test.ts` is a plain `.ts` file with no other project home (it lives under `apps/web/src/server`, outside `tests/routes/**`).
- **Fix:** Widened the "web" project's include glob to also admit `.test.ts`. Since jsdom's always-present `window` global trips `server-only.ts`'s browser guard, added a `// @vitest-environment node` docblock to the top of `jurisdiction-packs.test.ts` to override its environment back to Node for that one file.
- **Files modified:** `vitest.config.ts`, `apps/web/src/server/jurisdiction-packs.test.ts`
- **Verification:** `pnpm vitest run --project web -t "JURISDICTION-PACKS"` reports 8/8 passing; full suite green.
- **Committed in:** `01da023` (part of Task 1's commit)

---

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Necessary — the plan's own verify command could not otherwise run. No scope creep; the fix is additive and does not change any other test file's environment.

## Issues Encountered

None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plans 05-04 and 05-05 (wave 3) both depend on this plan and can now compose `StatusStrip`/consume `buildJurisdictionPackViews` freely. Full suite: 784/784 passing, lint/typecheck/depcruise all clean.
