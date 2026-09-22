---
phase: 06-convergence-and-legal-review
plan: 02
subsystem: ui
tags: [accessibility, wcag, tailwind, react, vitest]

requires: []
provides:
  - LineCard verdict badge with a real accessible name (aria-label)
  - LineCard unverified-rule marker with warn-toned visual treatment
  - TotalsRail's two indented sub-rows with ink-3-toned visual treatment
affects: [06-08]

actuals:
  tokens: 2348
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Real-DOM accessible-name assertions via react-dom/client createRoot into a jsdom container (no @testing-library dependency) — following apps/web/src/ui/intake/intake-form.test.tsx's established precedent"

key-files:
  modified:
    - apps/web/src/ui/review/line-card.tsx
    - apps/web/src/ui/review/line-card.test.tsx
    - apps/web/src/ui/review/totals-rail.tsx
    - apps/web/src/ui/review/totals-rail.test.tsx

key-decisions:
  - "No @testing-library/react or @testing-library/jest-dom installed — a new package install needs its own legitimacy checkpoint per this project's deviation rules. Instead, a narrow, spec-accurate implementation of the W3C AccName algorithm's aria-label step (step 2C) is used directly against real DOM elements rendered via react-dom/client's createRoot into a jsdom container, following intake-form.test.tsx's own established real-DOM-rendering precedent."
  - "TotalsRail's ink-3 className applied to the wrapping <div> of each indented row (not separately to its dt/dd pair) — the plan explicitly left this as the executor's call, and applying it once per row (not twice) matches the acceptance criterion's exact grep count of 2"

requirements-completed: [DISC-04, REVIEW-03]

coverage:
  - id: D1
    description: "Verdict badge's accessible name (via a real AccName-algorithm computation, not text-content) includes the verdict in words for all four verdicts"
    requirement: DISC-04
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/line-card.test.tsx#LINE-CARD: every verdict's badge has a real accessible name"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unverified-rule marker and both TotalsRail indented rows carry a colour treatment (warn / ink-3) distinct from their siblings, using only existing globals.css tokens"
    requirement: REVIEW-03
    verification:
      - kind: unit
        ref: "apps/web/src/ui/review/line-card.test.tsx#LINE-CARD: the unverified-rule marker carries a warn-toned className"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/review/totals-rail.test.tsx#TOTALS-RAIL: both indented sub-rows carry an ink-3-toned className"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 2: Verdict Badge Accessible Name + Totals Visual Distinctness Summary

**LineCard's verdict badge gained a real `aria-label`-based accessible name (DISC-04), and the unverified-rule marker plus TotalsRail's two indented sub-rows gained the UI-SPEC's warn/ink-3 colour treatment (REVIEW-03), both using only existing `globals.css` tokens.**

## Performance

- **Duration:** 25 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `LineCard`'s verdict-badge `<span>` carries `aria-label={VERDICT_LABELS[line.verdict]}`, closing the gap where its `generic` ARIA role gave it an empty computed accessible name despite visible text
- `LineCard`'s unverified-rule marker carries `className="border border-dashed border-warn text-warn"`
- `TotalsRail`'s two indented rows (`total-row-resting-unverified`, `total-row-excluded`) carry `className="text-ink-3"` on their wrapping `<div>`
- Both RED phases confirmed failing for the right reason before implementation; full `pnpm test` suite 852 → 855 passing, zero regressions

## Task Commits

1. **Task 1: Verdict badge accessible name (DISC-04/AC-32b)** - `7e52055` (test)
2. **Task 2: Visual distinctness for the unverified marker and the two indented totals rows (REVIEW-03)** - `162f073` (feat)

## Files Created/Modified
- `apps/web/src/ui/review/line-card.tsx` - aria-label on verdict badge; warn className on unverified marker
- `apps/web/src/ui/review/line-card.test.tsx` - real-DOM accessible-name test; warn-className test
- `apps/web/src/ui/review/totals-rail.tsx` - ink-3 className on both indented rows' wrapping divs
- `apps/web/src/ui/review/totals-rail.test.tsx` - ink-3 className test, asserting the five non-indented rows are unaffected

## Decisions Made
- No new npm package installed for the accessible-name test — `@testing-library/react`/`jest-dom` are absent from this repo, and adding either requires its own package-legitimacy checkpoint per this project's deviation rules. Instead, a narrow, spec-accurate implementation of the W3C AccName algorithm's `aria-label` step (which is checked before name-from-content and applies regardless of role) is used directly, against a real DOM tree rendered with `react-dom/client`'s `createRoot` into a jsdom container — the same real-DOM-rendering technique `intake-form.test.tsx` already established in this codebase.
- `TotalsRail`'s `ink-3` className applied once per row, on the wrapping `<div>`, not separately on the `<dt>`/`<dd>` pair — the plan explicitly left this choice to the executor ("or their wrapping `<div>` — executor's call"), and applying it once per row is what makes the acceptance criterion's exact grep count (`2`, one per indented row) hold; colour still cascades to the child `<dt>`/`<dd>` text via normal CSS inheritance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 4-adjacent, resolved via plan's own stated discretion] toHaveAccessibleName() matcher not available — used a narrow spec-accurate substitute**
- **Found during:** Task 1
- **Issue:** The plan's acceptance criteria named Testing Library's `toHaveAccessibleName()` matcher, which requires `@testing-library/jest-dom` — not installed in this repo, and no other package in this dependency tree pulls it in transitively
- **Fix:** Implemented `computeAriaLabelAccessibleName()`, a narrow, correct implementation of the W3C AccName algorithm's `aria-label` step (2C), applied to real DOM elements rendered via `react-dom/client`'s `createRoot` — proves the exact same fact (an `aria-label`-driven accessible name distinct from mere visible text content) without a new dependency
- **Files modified:** apps/web/src/ui/review/line-card.test.tsx
- **Verification:** RED phase confirmed failing on `expected null to be 'Needs your decision'` (the correct pre-fix failure); GREEN phase confirmed passing after the `aria-label` addition
- **Committed in:** 7e52055 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (test-infrastructure substitution, no scope creep — same behavior proven, no new dependency)
**Impact on plan:** None on delivered behavior; DISC-04's substance (a real accessible name, not merely visible text) is proven exactly as the plan intended.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
Both fixes land ahead of Wave 4's keyboard-navigation plan (06-08), which touches these same two components — that plan now builds on the corrected, already-tested versions rather than colliding with this fix mid-phase.

## Self-Check: PASSED

- FOUND: apps/web/src/ui/review/line-card.tsx
- FOUND: apps/web/src/ui/review/totals-rail.tsx
- FOUND commit: 7e52055
- FOUND commit: 162f073

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
