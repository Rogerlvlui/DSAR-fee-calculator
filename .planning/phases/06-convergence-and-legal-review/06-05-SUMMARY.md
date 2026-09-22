---
phase: 06-convergence-and-legal-review
plan: 05
subsystem: review
tags: [validation, disposition, ui-copy]

requires:
  - phase: 06-01
    provides: no direct dependency, sequenced after per depends_on
provides:
  - REASON_STOP_LIST (packages/schemas/src/constants.ts)
  - matchesReasonStopList / hasSufficientAndGenuineReason (apps/web/src/domain/disposition-actions.ts)
  - Server-side AC-23 stop-list enforcement (assertSufficientReason)
  - Client-side stock-phrase rejection copy (disposition-controls.tsx, bulk-accept-bar.tsx)
affects: [06-08]

actuals:
  tokens: 5174
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Stop-list-before-length ordering in a combined reason-validation gate — necessary whenever every stop-list entry is shorter than the length minimum, or the more specific message can never surface"

key-files:
  modified:
    - packages/schemas/src/constants.ts
    - apps/web/src/domain/disposition-actions.ts
    - apps/web/src/server/data/assessments.ts
    - apps/web/src/ui/review/disposition-controls.tsx
    - apps/web/src/ui/review/bulk-accept-bar.tsx

key-decisions:
  - "Stop-list check runs BEFORE the length check on both server and client — a deviation from the plan's literal length-then-stop-list ordering for the server, made because every one of REASON_STOP_LIST's 11 entries is under the 10-character minimum on its own (longest is \"agreed\" at 6 characters), so a length-first server check would make the stop-list branch permanently unreachable dead code and violate the plan's own acceptance criterion that the two error messages be distinguishable for a real request"
  - "hasSufficientReason's existing signature and behavior (length only) is completely unchanged — every existing caller keeps working; matchesReasonStopList and hasSufficientAndGenuineReason are new, additive exports"

requirements-completed: [REVIEW-05]

coverage:
  - id: D1
    description: "A disposition reason of an exact stop-list phrase is refused server-side with a distinct, named error, not silently accepted because it clears the length check"
    requirement: REVIEW-05
    verification:
      - kind: unit
        ref: "apps/web/src/domain/disposition-actions.test.ts (7 tests)"
        status: pass
      - kind: integration
        ref: "tests/routes/disposition.test.ts#DISPOSITION: a reason that is exactly a stop-list phrase"
        status: pass
    human_judgment: false
  - id: D2
    description: "The exact same stop-list constant, imported by client and server, is the only place either side checks a stock phrase"
    requirement: REVIEW-05
    verification:
      - kind: unit
        ref: "packages/schemas/src/constants.test.ts#REASON-STOP-LIST"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-20
status: complete
---

# Phase 6 Plan 5: AC-23 Reason Stop-List Summary

**Added the PRD's literal 11-item reason stop-list as one shared constant, enforced (stop-list checked before length, on both server and client) by the server's authoritative `assertSufficientReason` and rendered as distinct UI-SPEC copy by both `disposition-controls.tsx` and `bulk-accept-bar.tsx`.**

## Performance

- **Duration:** 40 min
- **Tasks:** 2
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- `REASON_STOP_LIST` added to `packages/schemas/src/constants.ts`, transcribed verbatim from the PRD, matching the file's own `PERSONAL_DATA_DENY_LIST`/`LEGAL_CONCLUSION_BANNED_WORDS` precedent
- `matchesReasonStopList` (whole-reason, trim+case-fold comparison — proven non-substring by a negative test) and `hasSufficientAndGenuineReason` added to `disposition-actions.ts`, additive to the unchanged `hasSufficientReason`
- Server's `assertSufficientReason` now refuses an exact stop-list phrase with a distinct `ValidationError`, checked BEFORE the length check (a documented, reasoned deviation — see Decisions)
- Both `disposition-controls.tsx` and `bulk-accept-bar.tsx`'s reason counter slot renders the UI-SPEC's stock-phrase copy (with the matched phrase interpolated) in place of the generic length-failure text when a stop-list phrase is what actually failed
- Full `pnpm test` suite: 863 → 877 passing (14 new: 1 constants, 7 disposition-actions, 2 route-level, 2 disposition-controls, 2 bulk-accept-bar), zero regressions

## Task Commits

1. **Task 1: REASON_STOP_LIST — the shared constant and its pure check** - `bd0ada4` (feat)
2. **Task 2: Wire the stop-list into the server gate and both client reason fields** - `309a32c` (feat)

## Files Created/Modified
- `packages/schemas/src/constants.ts` - `REASON_STOP_LIST` added
- `packages/schemas/src/constants.test.ts` - new, `REASON-STOP-LIST` tag
- `apps/web/src/domain/disposition-actions.ts` - `matchesReasonStopList`, `hasSufficientAndGenuineReason` added
- `apps/web/src/domain/disposition-actions.test.ts` - new, 7 tests
- `apps/web/src/server/data/assessments.ts` - `assertSufficientReason` extended, stop-list-first ordering
- `apps/web/src/ui/review/disposition-controls.tsx` / `.test.tsx` - stock-phrase counter copy, precedence chain
- `apps/web/src/ui/review/bulk-accept-bar.tsx` / `.test.tsx` - same, mirrored
- `tests/routes/disposition.test.ts` - 2 new route-level DISPOSITION tests

## Decisions Made
- **Stop-list checked before length, on the server too** (deviation from the plan's literal "after the existing length check... add" instruction): every one of the 11 stop-list entries (`ok`, `okay`, `fine`, `agreed`, `yes`, `no`, `n/a`, `na`, `noted`, `as above`, `same`) is shorter than the 10-non-whitespace-character minimum on its own — the longest, "agreed", is 6 characters. A length-first ordering would mean any bare stop-list phrase is *always* caught by the length check first, making the stop-list branch dead code and the plan's own acceptance criterion ("a route test can tell which check refused a given request," via distinguishable messages) permanently unsatisfiable. Checking stop-list first mirrors the reasoning the plan's own action text already gives for the CLIENT side ("checked first, since a stop-list phrase is also almost always short enough to already fail length") and applies the identical logic to the server.
- `hasSufficientReason`'s existing signature/behavior is completely unchanged; `matchesReasonStopList`/`hasSufficientAndGenuineReason` are new, additive exports, so no existing caller's meaning changed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan's own reasoning] Server-side check ordering corrected from length-first to stop-list-first**
- **Found during:** Task 2 (writing the RED-phase server route test)
- **Issue:** The plan's action text specified checking the length gate first, then the stop-list, on the server — but every stop-list entry is under the 10-character length minimum, so with that ordering the stop-list branch could never actually fire for any real request; the plan's own acceptance criterion (distinguishable error messages for a route test to tell which check refused) would be unsatisfiable
- **Fix:** Implemented stop-list check first, length check second — mirroring the client-side precedence the plan's own Task 2 prose already reasons through for exactly this class of case
- **Files modified:** apps/web/src/server/data/assessments.ts, apps/web/src/ui/review/disposition-controls.tsx, apps/web/src/ui/review/bulk-accept-bar.tsx
- **Verification:** `tests/routes/disposition.test.ts`'s new stop-list test asserts the two error messages are genuinely distinct strings for a real request; RED confirmed before the fix, GREEN after
- **Committed in:** 309a32c (Task 2 commit)

**2. [Rule 1 - Bug] React HTML-escapes apostrophes, breaking literal-string test assertions**
- **Found during:** Task 2 (RED confirmation for the client component tests)
- **Issue:** `toContain(REASON_COUNTER_FAILURE_TEXT)` / the literal "That's a stock phrase..." string both contain apostrophes, which `renderToStaticMarkup` escapes to `&#x27;` in the rendered HTML — a literal-string assertion would never match regardless of correctness
- **Fix:** Assertions reworded to apostrophe-free substrings, or the expected literal is itself `.replace(/'/g, "&#x27;")`'d before comparison
- **Files modified:** apps/web/src/ui/review/disposition-controls.test.tsx, apps/web/src/ui/review/bulk-accept-bar.test.tsx
- **Verification:** Both test files pass with the corrected assertions
- **Committed in:** 309a32c (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug in the plan's own reasoning, 1 pre-existing HTML-escaping gotcha) — both necessary for the plan's own stated acceptance criteria to be achievable at all, no scope creep.

## Issues Encountered
None beyond the two deviations above, both resolved within Task 2's own verification loop.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
REVIEW-05/AC-23 is fully discharged on both server and client. No blockers for Wave 3 (06-06, 06-07) or Wave 4 (06-08, which also touches `disposition-controls.tsx` for keyboard navigation — the stop-list wiring here is additive to that file's existing structure and does not change its DOM shape in a way that would collide).

## Self-Check: PASSED

- FOUND: packages/schemas/src/constants.ts
- FOUND: apps/web/src/domain/disposition-actions.ts
- FOUND commit: bd0ada4
- FOUND commit: 309a32c

---
*Phase: 06-convergence-and-legal-review*
*Completed: 2026-09-20*
