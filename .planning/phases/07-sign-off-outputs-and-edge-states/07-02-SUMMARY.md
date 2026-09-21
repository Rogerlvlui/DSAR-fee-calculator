---
phase: 07-sign-off-outputs-and-edge-states
plan: 02
subsystem: api
tags: [sign-off, state-machine, http-status, authorization, audit]

# Dependency graph
requires:
  - phase: 07-sign-off-outputs-and-edge-states
    provides: "07-01's internal-record PDF architecture (unrelated surface, same signOff()-adjacent codebase, read for awareness only)"
  - phase: 04-workflow-and-audit-backbone
    provides: "packages/audit's memoryPackLifecycleEventWriter and PackLifecycleEvent stream — the canonical activation-actor source PACK-08 queries"
provides:
  - "signOff()'s still-PENDING and unacknowledged-flag refusals corrected from 400 to 409, with the pending-lines refusal naming every outstanding ExpenseLine.seq"
  - "PACK-08/AC-41b: a 403 guard refusing sign-off by the actor who last activated the assessment's pinned rule pack version"
  - "Route-level proof of SIGNOFF-04's full eight-field SignOff record and ACCESS-04's role refusal against every non-reviewer demo role"
affects: [07-04-dense-line-item-table, 07-05-download-trigger-placement, 07-06]

# Actuals (#2632)
actuals:
  tokens: 9600
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "409 ConflictError for every precondition on the same guard-table transition row (SIGN_OFF), reserving 400 ValidationError strictly for malformed input — a caller no longer has to remember which of two preconditions on the identical transition returns which code"
    - "A new sign-off precondition (PACK-08) placed as a specific, human-readable early refusal ahead of the existing structural guard, following signOff()'s own documented precedent, rather than widening the frozen 11-member GuardInput"
    - "D-02's synthetic-fixture technique: write a PackLifecycleEvent directly through the memory-backed writer to vary 'who activated this pack version', while every sign-off attempt uses the same real, single LEGAL_REVIEWER demo cookie"

key-files:
  created:
    - tests/routes/pack-lifecycle-signoff.test.ts
  modified:
    - apps/web/src/server/data/assessments.ts
    - tests/routes/signoff.test.ts
    - tests/routes/audit-trail.test.ts
    - tests/routes/live-routing.test.ts
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PACK-08 throws ForbiddenError (403), not ConflictError (409) — settles 07-RESEARCH.md Open Question 2 in favour of 403, per the plan's own explicit instruction: the refusal is about who the actor is (matching ACCESS-04's requireRole refusal class), not the matter's state."
  - "The flag-acknowledgement precondition (SIGNOFF-02) also moved to 409, settling 07-RESEARCH.md Open Question 1 in favour of consistency — both are preconditions on the identical SIGN_OFF guard-table row, and AC-24 names no status code so nothing in the PRD is contradicted."
  - "resolvePinnedRulePack's call site moved earlier in signOff() (before computeFinalAmount, not after) so the PACK-08 guard has the pinned pack id/version available before anything is computed — the guard's own placement requirement from the plan's action text."

patterns-established:
  - "New sign-off precondition tests reuse an existing fixture-building technique (create matter, add lines, submit, disposition every line) rather than inventing a second builder — tests/routes/pack-lifecycle-signoff.test.ts mirrors tests/routes/signoff.test.ts exactly."

requirements-completed: [SIGNOFF-01, SIGNOFF-02, SIGNOFF-04, ACCESS-04, PACK-08]

coverage:
  - id: D1
    description: "Sign-off refused while any line is PENDING returns 409 (not 400) and names every outstanding line by its ExpenseLine.seq, ascending — a single-line case names exactly that line and no other"
    requirement: SIGNOFF-01
    verification:
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: sign-off with any line still pending is refused at 409, naming every outstanding line by seq"
        status: pass
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: sign-off with exactly one line still pending names that single line and no other"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sign-off refused while an acknowledgement-requiring matter flag is unacknowledged returns 409 (not 400) and names the flag; zero acknowledgement-requiring flags plus an empty acknowledgedFlags array signs off at 200; a duplicate flag id in acknowledgedFlags is tolerated; an unknown flag id stays 400"
    requirement: SIGNOFF-02
    verification:
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: an unacknowledged matter flag that requires acknowledgement is refused at 409, naming the flag"
        status: pass
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: zero acknowledgement-requiring flags plus an empty acknowledgedFlags array signs off at 200"
        status: pass
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: the same real flag id listed twice in acknowledgedFlags still signs off at 200"
        status: pass
    human_judgment: false
  - id: D3
    description: "The actor who last activated the assessment's pinned rule pack version is refused sign-off at 403, naming the pack id/version and pointing to another reviewer; a different activator, zero activation events, a superseded earlier activation, and a PACK_EDITED (not PACK_ACTIVATED) event all proceed at 200"
    requirement: PACK-08
    verification:
      - kind: integration
        ref: "tests/routes/pack-lifecycle-signoff.test.ts#PACK-ACTIVATION-SIGNOFF (5 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every one of SignOff's eight fields is populated and correctly typed on a real stored record; finalAmount is an integer equal to totals.finalAmount; pinned rulePackId/rulePackVersion/engineVersion survive sign-off unchanged; qualification boundary cases (one char, whitespace-only, padded) behave correctly"
    requirement: SIGNOFF-04
    verification:
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF-04 (6 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Sign-off refused at 403 for both non-reviewer demo roles (HR_PREPARER, DPO_ADMIN), and the HR_PREPARER refusal body carries no assessment or attestationText key"
    requirement: ACCESS-04
    verification:
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: sign-off carrying the HR role cookie is refused with 403, changes nothing, and the body carries no assessment content (ACCESS-04)"
        status: pass
      - kind: integration
        ref: "tests/routes/signoff.test.ts#SIGNOFF: sign-off carrying the DPO_ADMIN role cookie is refused with 403 on the same endpoint (ACCESS-04)"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-21
status: complete
---

# Phase 7 Plan 2: Sign-off Gate Corrections and the PACK-08 Guard Summary

**signOff()'s two mis-coded 400 refusals corrected to 409 with full pending-line naming, a new 403 PACK-08 activator-guard added, and SIGNOFF-04/ACCESS-04 proven by route-level assertion against a real stored record and every non-reviewer demo role.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3 (all executed, no checkpoints)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `signOff()`'s still-PENDING refusal now throws `ConflictError` (409), naming every outstanding line by its `ExpenseLine.seq` in ascending order via a single `listExpenseLines()` call moved earlier in the function and reused by the later structural guard rather than fetched twice
- The unacknowledged-required-flag refusal also moved from `ValidationError` (400) to `ConflictError` (409) — both are preconditions on the identical `SIGN_OFF` guard-table row, so a caller no longer has to remember which is which; the three genuinely malformed-input refusals (unknown flag id, unaffirmed attestation, empty qualification) stay 400, locked by an unchanged test
- A new PACK-08/AC-41b guard: the actor about to sign off is refused at 403 when the latest `PACK_ACTIVATED` event for the assessment's pinned pack id/version names them as the activator — queries `packages/audit`'s own canonical `memoryPackLifecycleEventWriter` rather than building a second source of truth, compared by exact `UserRef.id` string equality only
- `tests/routes/pack-lifecycle-signoff.test.ts` (new, tagged `PACK-ACTIVATION-SIGNOFF`) proves the positive case, a different-activator negative case, a zero-activation-event case, a superseded-earlier-activation case, and a `PACK_EDITED`-does-not-block case — all using the same real `LEGAL_REVIEWER` cookie, varying only the synthetic activation event's own actor (D-02's technique)
- `tests/routes/signoff.test.ts` extended with SIGNOFF-04's full eight-field proof (lawyer, lawyerName, qualification, signedAt, finalAmount, acknowledgedFlags, attestation, attestationVersion), the money-integrity cross-check, pinned-provenance-survives-sign-off proof, three qualification boundary cases, and ACCESS-04 proven against both non-reviewer demo roles (`HR_PREPARER`, `DPO_ADMIN`) with a body-shape assertion
- Full suite 962 (post-07-01) → 976 passing; `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise` all clean throughout; `packages/schemas/` and `packages/workflow/` left untouched by this plan, confirmed via `git status`

## Task Commits

1. **Task 1: SIGNOFF-01 and SIGNOFF-02 — 409 refusals that name what is outstanding** - `d737bb2` (fix, tdd)
2. **Task 2: PACK-08 / AC-41b — the activator cannot sign off their own activated pack version** - `c380efb` (feat, tdd)
3. **Task 3: SIGNOFF-04 and ACCESS-04 — prove the recorded field set and the role refusal** - `7c3f6cd` (test)

**Plan metadata:** commit pending (this SUMMARY + STATE.md/ROADMAP.md update)

## Files Created/Modified
- `apps/web/src/server/data/assessments.ts` - `signOff()`: pending-lines and flag-ack refusals corrected to 409 with line-naming; new PACK-08 guard between pack resolution and `computeFinalAmount`; `resolvePinnedRulePack` call moved earlier
- `tests/routes/signoff.test.ts` - status-code corrections, new pending-line-naming/single-line/zero-flags/duplicate-flag cases, SIGNOFF-04 field-completeness and qualification-boundary cases, ACCESS-04 DPO_ADMIN case
- `tests/routes/pack-lifecycle-signoff.test.ts` - new file, PACK-08's five route-level cases
- `tests/routes/audit-trail.test.ts` - one pre-existing 400 assertion on the same pending-lines refusal path corrected to 409 (collateral, same intentional change)
- `tests/routes/live-routing.test.ts` - one pre-existing 400 assertion on the same pending-lines refusal path corrected to 409, with its stale comment fixed (collateral, same intentional change)
- `.planning/REQUIREMENTS.md` - SIGNOFF-01, SIGNOFF-02, SIGNOFF-04, ACCESS-04, PACK-08 marked Complete

## Decisions Made
- PACK-08 is `ForbiddenError`/403, not `ConflictError`/409 — the plan's own action text settles 07-RESEARCH.md's Open Question 2 in favour of 403 (the refusal is about actor identity, matching `ACCESS-04`'s class of refusal).
- SIGNOFF-02's flag-acknowledgement refusal also moved to 409 for consistency with SIGNOFF-01, settling Open Question 1.
- `resolvePinnedRulePack`'s call site moved before `computeFinalAmount` (previously after) so PACK-08's guard has the pinned pack id/version available before the guard runs — required by the plan's own placement instruction ("after pack is resolved and before computeFinalAmount").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two pre-existing tests elsewhere in the suite asserted the now-stale 400 status on the same pending-lines refusal path**
- **Found during:** Task 1's `pnpm test` verify step
- **Issue:** `tests/routes/audit-trail.test.ts` and `tests/routes/live-routing.test.ts` each drive a fixture through `signOff()` without dispositioning any line, hitting the exact pending-lines refusal Task 1 changed from 400 to 409 — both asserted the old status.
- **Fix:** Updated both assertions to 409; corrected `live-routing.test.ts`'s own stale inline comment, which had misattributed the refusal to the unacknowledged-flag case rather than the actual pending-lines case it exercises.
- **Files modified:** `tests/routes/audit-trail.test.ts`, `tests/routes/live-routing.test.ts`
- **Verification:** `pnpm test` — full suite green (965/965 at that point).
- **Committed in:** `d737bb2` (Task 1 commit)

**2. [Rule 1 - Bug] pack-lifecycle-signoff.test.ts's initial single-line fixture always produced a FLAG verdict**
- **Found during:** Task 2, first run of the new test file
- **Issue:** A single-line matter puts that line at 100% of the claimed total, tripping the engine's own MATERIALITY cross-line check (>= 40% of total) and forcing FLAG regardless of the category's own ALLOW treatment — the disposition route then refused `ACCEPT` on a FLAG-verdict line.
- **Fix:** Reused `tests/routes/signoff.test.ts`'s own proven four-line composition (which keeps every line under the 40% threshold except the deliberately-FLAG `OTHER_UNCLASSIFIED` line) and dispositioned by verdict (`STRIKE` for FLAG, `ACCEPT` otherwise).
- **Files modified:** `tests/routes/pack-lifecycle-signoff.test.ts`
- **Verification:** `pnpm vitest run --project routes -t "PACK-ACTIVATION-SIGNOFF"` — 5/5 passing.
- **Committed in:** `c380efb` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs — one a stale test assertion elsewhere in the suite, one a fixture-design bug in new test code)
**Impact on plan:** Both necessary for a fully green suite. No scope creep — no production code touched beyond the plan's own declared `assessments.ts`.

## Issues Encountered
None beyond the two auto-fixed items above.

## Known Stubs
None — every task's production code and its own tests landed together; no placeholder or deferred data path was introduced.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The sign-off gate is now fully closed: SIGNOFF-01/02/04, ACCESS-04 and PACK-08 all discharged and marked Complete in REQUIREMENTS.md.
- `packages/schemas/` and `packages/workflow/` remain untouched — 07-04/07-05/07-06 inherit an unchanged guard table and an unchanged frozen `GuardInput`.
- `signOff()`'s refusal ordering is unchanged in shape (requireRole → legal-review precondition → pending-lines → flag-ack → unknown-flag → attestation → qualification → PACK-08 → compute/write) — later plans touching the sign-off panel or its route can rely on this order being stable.

---
*Phase: 07-sign-off-outputs-and-edge-states*
*Completed: 2026-09-21*

## Self-Check: PASSED

- FOUND: tests/routes/pack-lifecycle-signoff.test.ts
- FOUND: apps/web/src/server/data/assessments.ts
- FOUND: tests/routes/signoff.test.ts
- FOUND: tests/routes/audit-trail.test.ts
- FOUND: tests/routes/live-routing.test.ts
- FOUND: .planning/REQUIREMENTS.md
- FOUND commit d737bb2 (Task 1)
- FOUND commit c380efb (Task 2)
- FOUND commit 7c3f6cd (Task 3)
