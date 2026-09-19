---
phase: 05-hr-intake-and-disclosure-shell
plan: 02
subsystem: intake-personal-data-guardrails
tags: [zod, react, personal-data, warn-only, free-text-limits]

# Dependency graph
requires:
  - phase: 01-schemas-and-constants
    provides: "FREE_TEXT_LIMITS (packages/schemas/src/constants.ts), the frozen per-field character caps"
provides:
  - "detectLikelyPersonalData, PersonalDataPatternMatch — new pure exports from packages/schemas/src/personal-data-pattern.ts, ready for Phase 6's lawyerReason wiring"
  - "expense-line-repeater.tsx's description field now reads FREE_TEXT_LIMITS.description instead of a hardcoded 300"
  - "Live, non-blocking pattern warnings and character counters on description and identityVerifiedNote"
affects: [06-convergence-and-legal-review (lawyerReason wiring reuses detectLikelyPersonalData)]

# Actuals (#2632)
actuals:
  tokens: 3622
  tasks: 2
  commits: 2
  plan_head_before: 07cf290b4076f0ee184522cc8b54fe8b521af601

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A warn-never-block pattern check is a pure function with no return channel a caller could use to gate submission — proven by a grep-based acceptance criterion rather than only by test coverage"

key-files:
  created:
    - packages/schemas/src/personal-data-pattern.ts
    - packages/schemas/src/personal-data-pattern.test.ts
    - apps/web/src/ui/intake/attestations-panel.test.tsx
  modified:
    - apps/web/src/ui/intake/expense-line-repeater.tsx
    - apps/web/src/ui/intake/expense-line-repeater.test.tsx
    - apps/web/src/ui/intake/attestations-panel.tsx

key-decisions:
  - "The three pattern shapes (email, SG NRIC/FIN, long digit run) are RESEARCH's own proposed shapes, implemented verbatim as a reasonable starting set — not yet product-owner-ratified (05-RESEARCH.md Assumption A3)"
  - "lawyerReason is deliberately not wired here — Phase 6's job per ROADMAP's own closing note"
  - "No server-side mirror of the pattern check — client-only scope per 05-RESEARCH.md Open Question 2, since BOUND-04 names no server-side assertion"

requirements-completed: [BOUND-03, BOUND-04]

coverage:
  - id: D1
    description: "Every free-text field's character limit is read from FREE_TEXT_LIMITS, never a literal — the description field's hardcoded 300 is gone"
    requirement: "BOUND-03"
    verification:
      - kind: unit
        ref: "apps/web/src/ui/intake/expense-line-repeater.test.tsx#REPEATER: description free-text limit and pattern warning — maxLength assertion against the imported constant"
        status: pass
    human_judgment: false
  - id: D2
    description: "Typing something that looks like an email address, a long digit run, or an NRIC/FIN-shaped token into the description field or the identity note shows a live, dismissible-by-editing warning naming why, and never disables or blocks submission"
    requirement: "BOUND-04"
    verification:
      - kind: unit
        ref: "packages/schemas/src/personal-data-pattern.test.ts#personal-data-pattern — 8 tests including the invoice-number false-positive control"
        status: pass
      - kind: unit
        ref: "apps/web/src/ui/intake/expense-line-repeater.test.tsx and attestations-panel.test.tsx — live warning renders/does-not-render per field"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-19
status: complete
---

# Phase 5 Plan 2: Personal-Data Field Discipline Summary

**`detectLikelyPersonalData` — a new, narrow, hand-authored warn-never-block pattern check — is wired live into the description and identity-note fields, alongside fixing the description field's hardcoded 300-character limit to read the frozen `FREE_TEXT_LIMITS` constant.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2 completed
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- `detectLikelyPersonalData` in `packages/schemas` implements PRD §12.1's three ordered pattern checks (email, SG NRIC/FIN, 7+ digit run), proven never to false-positive on an invoice-number-shaped string and never to throw on any input including the empty string.
- `expense-line-repeater.tsx`'s description field's `maxLength` now reads `FREE_TEXT_LIMITS.description` — the one known BOUND-03 drift closed.
- Both `description` and `identityVerifiedNote` render a live, computed-at-render warning and a `{n} / {limit} characters` counter with zero new gating logic — `intake-form.tsx` is untouched.

## Task Commits

1. **Task 1: `detectLikelyPersonalData`** - `3e978cb` (feat)
2. **Task 2: Wire the limit fix and live warning into the two named fields** - `9218fbf` (feat)

## Files Created/Modified

- `packages/schemas/src/personal-data-pattern.ts` — `detectLikelyPersonalData`, `PersonalDataPatternMatch`
- `packages/schemas/src/personal-data-pattern.test.ts` — 8 tests
- `apps/web/src/ui/intake/expense-line-repeater.tsx` — `FREE_TEXT_LIMITS.description`, live warning, counter
- `apps/web/src/ui/intake/expense-line-repeater.test.tsx` — 4 new tests
- `apps/web/src/ui/intake/attestations-panel.tsx` — live warning, counter alongside the existing static warning
- `apps/web/src/ui/intake/attestations-panel.test.tsx` — new, first test file for this component (5 tests)

## Decisions Made

See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

React's SSR HTML-escapes the apostrophe in `IDENTITY_NOTE_WARNING` to `&#x27;` — the initial test assertion comparing the rendered markup directly against the raw JS string constant failed; reworded to assert a substring without an apostrophe instead. No production code change.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 05-03 depends only on 05-01; this plan (05-02) has no downstream dependents within Phase 5. Full suite: 763/763 passing (one property-test timeout observed and confirmed as the known CPU-load-sensitive flake via an isolated re-run — not a regression), lint/typecheck/depcruise all clean.
