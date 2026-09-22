---
phase: 06-convergence-and-legal-review
plan: 08
subsystem: ui
tags: [keyboard, accessibility, wcag, review, queue]

requires:
  - phase: 06-02
    provides: line-card.tsx's corrected DISC-04/REVIEW-03 treatment (this plan builds on it additively)
  - phase: 06-06
    provides: "/legal/queue's stable row structure"
  - phase: 06-07
    provides: assessment-view.tsx's flatFeeChoice/recomputeBanner slots (this plan's cards-region wrapping composes alongside them)
provides:
  - Pure keyboard-shortcuts.ts key->intent map
  - Shared ShortcutHelpOverlay + ShortcutHelpTrigger
  - ReviewKeyboardScope (j/k/a/r/s/?)
  - QueueKeyboardScope (j/k/Enter/?)
affects: [06-09]

actuals:
  tokens: 11008
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "DOM-query dispatch onto an existing component's data-action hooks — a keyboard scope drives disposition-controls.tsx's real buttons/inputs from outside, with zero changes to that component's own internals"
    - "null-initialized clamped focus index (first j OR k lands on index 0) shared identically between ReviewKeyboardScope and QueueKeyboardScope"

key-files:
  created:
    - apps/web/src/domain/keyboard-shortcuts.ts
    - apps/web/src/ui/chrome/shortcut-help-overlay.tsx
    - apps/web/src/ui/review/review-keyboard-scope.tsx
    - apps/web/src/ui/queue/queue-keyboard-scope.tsx
  modified:
    - apps/web/src/ui/review/line-card.tsx
    - apps/web/src/ui/review/assessment-view.tsx
    - "apps/web/app/legal/queue/page.tsx"

key-decisions:
  - "No third-party keybinding library added (react-hotkeys-hook, mousetrap both rejected in 06-RESEARCH.md's own Alternatives Considered row) — a pure switch-statement key->intent map plus a hand-rolled window keydown listener stays inside this codebase's own 'don't hand-roll' territory reversed at this scale"
  - "keyboard-shortcuts.ts is fully framework-free (zero react/DOM imports) — callers own the modifier-key and typing-target guards, keeping the pure map trivially unit-testable in isolation"
  - "Both keyboard scopes use a null-initialized focusedIndex (not 0) so the FIRST j or k press lands on index 0 (the first card/row) rather than skipping to index 1 — proven by dedicated tests on both scopes"
  - "The reduce-amount input is located via its sibling relationship to the [data-action=\"reduce\"] button's own parent element, not a new data-attribute on the input itself — no change to disposition-controls.tsx's existing markup structure"
  - "jsdom does not implement scrollIntoView — guarded with an optional call (card?.scrollIntoView?.(...)) rather than polyfilled, since this codebase's test environment is jsdom and the call is UX polish only, never load-bearing for correctness"

requirements-completed: [REVIEW-08, NAV-03]

coverage:
  - id: D1
    description: "A 20-line review can be completed with the keyboard alone: j/k move focus, a/s trigger the focused card's own existing button, r focuses its amount field, ? opens a real accessible help overlay, and a key with no defined action for the focused line is a silent no-op"
    requirement: REVIEW-08
    verification:
      - kind: unit
        ref: "apps/web/src/domain/keyboard-shortcuts.test.ts (8 tests)"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/chrome/shortcut-help-overlay.test.tsx#SHORTCUT-HELP-OVERLAY (7 tests)"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/review/review-keyboard-scope.test.tsx (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "/legal/queue is keyboard navigable: j/k move focus between rows, native Enter opens the focused row, ? opens the same shared overlay with queue-specific bindings"
    requirement: NAV-03
    verification:
      - kind: unit
        ref: "apps/web/src/ui/queue/queue-keyboard-scope.test.tsx (5 tests)"
        status: pass
      - kind: integration
        ref: "tests/routes/legal-queue.test.ts#LEGAL-QUEUE (pre-existing, reconfirmed unchanged with the wrapping added)"
        status: pass
    human_judgment: false

duration: 75min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 8: Keyboard-First Review Flow + Shared Shortcut Overlay Summary

**Built keyboard-first navigation from scratch for both interactive surfaces this phase touches: `ReviewKeyboardScope` (j/k/a/r/s/?) drives `disposition-controls.tsx`'s existing `data-action` DOM hooks with zero changes to that component's internals, and `QueueKeyboardScope` (j/k/Enter/?) does the same for `/legal/queue`'s row list — both sharing one hand-rolled, WCAG-compliant `ShortcutHelpOverlay`.**

## Performance

- **Duration:** 75 min
- **Tasks:** 3
- **Files modified:** 11 (7 created, 4 modified)

## Accomplishments
- `apps/web/src/domain/keyboard-shortcuts.ts`: a pure, framework-free key→intent map for both surfaces — no third-party keybinding dependency
- `apps/web/src/ui/chrome/shortcut-help-overlay.tsx`: one shared `role="dialog" aria-modal="true"` overlay with a real focus trap, Escape-to-close, and a persistent, Tab-reachable trigger button — never a keystroke-only entry point
- `ReviewKeyboardScope`: j/k move a clamped focus index across line cards; a/s `.click()` the real accept/strike buttons if present (silent no-op otherwise); r focuses the reduce amount input; a keydown while typing in an input/textarea/select is ignored entirely, proven by its own dedicated test
- `QueueKeyboardScope`: j/k move focus across row anchors; native Enter-on-anchor is relied on, never re-implemented (confirmed by grep: no `.click()`/`router.push()` for the `OPEN` intent anywhere in the file)
- `line-card.tsx` gained `data-line-id`/`tabIndex={-1}`/a focus-seal outline class additively — its own 8 LINE-CARD tests unchanged; `disposition-controls.tsx` itself was never touched (its `onClick`/`handleSubmit` occurrence count confirmed identical before and after)
- Auth call-site counts on `/legal/queue`'s page confirmed unchanged (3) across this task's wiring
- Full `pnpm test` suite: 912 → 940 passing (28 new), zero regressions

## Task Commits

1. **Task 1: keyboard-shortcuts.ts — the pure key-to-intent mapping, and the shared help overlay** - `3eb52c5` (feat)
2. **Task 2: ReviewKeyboardScope — wiring j/k/a/r/s/? onto the legal review screen** - `5207b04` (feat)
3. **Task 3: QueueKeyboardScope — wiring j/k/Enter/? onto /legal/queue** - `053ce12` (feat)

## Files Created/Modified
- `apps/web/src/domain/keyboard-shortcuts.ts` / `.test.ts` - pure `mapReviewKey`/`mapQueueKey`, 8 tests
- `apps/web/src/ui/chrome/shortcut-help-overlay.tsx` / `.test.tsx` - shared overlay + trigger, 7 tests
- `apps/web/src/ui/review/review-keyboard-scope.tsx` / `.test.tsx` - review screen scope, 8 tests
- `apps/web/src/ui/review/line-card.tsx` - additive `data-line-id`/`tabIndex`/focus-ring class
- `apps/web/src/ui/review/assessment-view.tsx` - wraps `assessment-lines` in `ReviewKeyboardScope`
- `apps/web/src/ui/queue/queue-keyboard-scope.tsx` / `.test.tsx` - queue scope, 5 tests
- `apps/web/app/legal/queue/page.tsx` - wraps row list in `QueueKeyboardScope`, adds `data-row-id`

## Decisions Made
- Both keyboard scopes model `focusedIndex` as `number | null` (not `0`) — the first `j`/`k` press lands on index 0, matching the plan's own stated behavior ("pressing j moves DOM focus to the first card"); an initial `0` would have skipped straight to the second card on the first press
- The reduce-amount input is located via `[data-action="reduce"]`'s own parent element (the `<span>` wrapping the label+input+button), not a new attribute — zero markup changes to `disposition-controls.tsx`
- `card?.scrollIntoView?.(...)` guards against jsdom's missing implementation rather than polyfilling it — a real-browser UX nicety, never load-bearing for the correctness this plan's tests verify

## Deviations from Plan

None — plan executed exactly as written. Two small, necessary corrections surfaced during each task's own verification loop:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom has no scrollIntoView implementation**
- **Found during:** Task 2 (review-keyboard-scope.test.tsx's first run)
- **Issue:** `focusLine`'s unconditional `card.scrollIntoView({...})` call threw `TypeError: card?.scrollIntoView is not a function` under jsdom, which does not implement this browser-only API
- **Fix:** Changed to an optional-call guard (`card?.scrollIntoView?.({...})`)
- **Files modified:** apps/web/src/ui/review/review-keyboard-scope.tsx (later mirrored in queue-keyboard-scope.tsx from the start)
- **Verification:** All review-keyboard-scope tests pass
- **Committed in:** 5207b04 (Task 2 commit)

**2. [Rule 3 - Blocking] React.createElement's typed overloads don't reconcile a required `children` prop against variadic children arguments**
- **Found during:** Task 2 (typecheck)
- **Issue:** `ReviewKeyboardScopeProps.children: ReactNode` (required) failed to typecheck against test calls using `React.createElement(Component, {lineIds}, ...childElements)` — TypeScript checks the props object literal against the full prop type without accounting for children supplied via the variadic arguments
- **Fix:** Made `children` optional in the type (`children?: ReactNode`), documented as a type-level accommodation only — every real caller supplies it via JSX, where it is effectively required
- **Files modified:** apps/web/src/ui/review/review-keyboard-scope.tsx
- **Verification:** `pnpm run typecheck` exits 0
- **Committed in:** 5207b04 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both blocking, both test-environment/type-system accommodations with no production behavior change)
**Impact on plan:** None on delivered behavior.

## Issues Encountered
A stray, auto-regenerated `apps/web/next-env.d.ts` diff appeared in the working tree partway through this plan (Next.js's own dev-server type-reference injection, triggered by some earlier tool invocation elsewhere in this session) — reverted via `git checkout --` before committing Task 2, since it is an explicitly "do not edit" generated file unrelated to this plan's own changes.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
REVIEW-08 and NAV-03 are both fully discharged. Wave 5's regression sweep (06-09) can now exercise the complete, already-built review UI — including this plan's keyboard affordances — against real HK/SG data. No blockers.

## Self-Check: PASSED

- FOUND: apps/web/src/domain/keyboard-shortcuts.ts
- FOUND: apps/web/src/ui/chrome/shortcut-help-overlay.tsx
- FOUND commit: 3eb52c5
- FOUND commit: 5207b04
- FOUND commit: 053ce12

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
