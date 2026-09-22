---
phase: 04-workflow-and-audit-backbone
plan: 05
subsystem: workflow-audit
tags: [state-machine, audit-log, correction, superseded, closing-transition, intake-audit, in-memory-repository]

# Dependency graph
requires:
  - phase: 04-workflow-and-audit-backbone (plans 01-04)
    provides: "packages/workflow's complete guard table (including the SIGNED_OFF->SUPERSEDE, CLOSED->SUPERSEDE and SIGNED_OFF->MARK_SENT rows) and evaluateTransition executor; packages/audit's AuditEventWriter/PackLifecycleEventWriter; every matter-scoped transition/disposition/sign-off call site already routed through the guarded executor and audited"
provides:
  - "apps/web/src/server/repositories/interface.ts + memory/assessment-repository.ts: listAssessmentsByMatterId(); getAssessmentByMatterId() now returns the LAST assessment written, not the first"
  - "apps/web/src/server/data/assessments.ts: raiseCorrection() — a signed-off record is read and never rewritten; a second assessment is raised under a freshly generated identifier, never the engine's own derived one"
  - "New POST /api/assessments/[id]/supersede route"
  - "apps/web/src/server/data/matters.ts: markNoticeSent now drives SIGNED_OFF -> CLOSED through the executor; createMatter/addExpenseLine/replaceExpenseLine/deleteExpenseLine each record an audit event"
  - "packages/audit/src/payload-builders.ts: supersededPayload, matterCreatedPayload, expenseLineAddedPayload/EditedPayload/DeletedPayload"
  - "tests/routes/correction.test.ts (CORRECTION, 11 tests) and tests/routes/lifecycle.test.ts (LIFECYCLE, 9 tests, including the whole-lifecycle proof and the audit event-type coverage test)"
  - "04-VALIDATION.md fully populated across all five plans, nyquist_compliant: true"
affects: [05-hr-intake-and-disclosure-shell, 06-convergence-and-legal-review, 07-signoff-outputs-and-edge-states]

# Actuals (#2632)
actuals:
  tokens: 15881
  tasks: 3
  commits: 2
  plan_head_before: dbca01a

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A correction that supersedes a signed record is built as the deliberate MIRROR IMAGE of an in-place recompute: recompute.ts PRESERVES an identity (record not yet final), raiseCorrection() CREATES a new one (record final, must survive untouched) — each module's comment points at the other, and a source-scan test proves no import crosses between them"
    - "getAssessmentByMatterId's semantics moved from first-match to last-match once a matter could hold more than one assessment; identical behaviour with one assessment on file, diverging only after a correction exists"
    - "Audit payload builders for intake acts (matter creation, line add/edit/delete) snapshot only the fields that build a claim (categoryCode/quantity/unit/unitRate/claimedAmount), deliberately excluding free-text fields from an append-only-forever log"

key-files:
  created:
    - apps/web/app/api/assessments/[id]/supersede/route.ts
    - tests/routes/correction.test.ts
    - tests/routes/lifecycle.test.ts
  modified:
    - apps/web/src/server/repositories/interface.ts
    - apps/web/src/server/repositories/memory/assessment-repository.ts
    - apps/web/src/server/data/assessments.ts
    - apps/web/src/server/data/matters.ts
    - apps/web/src/server/recompute.ts
    - "apps/web/app/(hr)/matters/[id]/page.tsx"
    - packages/audit/src/payload-builders.ts
    - tests/routes/workflow-tracer.test.ts
    - .planning/phases/04-workflow-and-audit-backbone/04-VALIDATION.md

key-decisions:
  - "Checkpoint 04-05-CP pre-resolved by the product owner ahead of execution: Option A (literal transcription). Not presented interactively; treated as already answered per the executor's prompt instructions."
  - "The open 're-review after correction' gap is a genuine, unresolved PRD spec gap (SUPERSEDED has no outgoing row) — tracked as WINDOWS.md entry 9 and in STATE.md's Blockers/Concerns, not invented or resolved here."
  - "raiseCorrection() does not call recompute.ts's recomputeAssessment() — deliberately separate mirror-image modules, each commented against the other."
  - "markNoticeSent (SIGNED_OFF -> CLOSED) reverses 03.1-04's recorded deferral now that a guarded executor exists and this phase's own success criterion names CLOSED explicitly."
  - "getSignedOffAssessmentForHr widened to permit CLOSED alongside SIGNED_OFF; the HR result page's branch widened to match."
  - "tests/routes/workflow-tracer.test.ts's event counts updated (2->4, 0->1) as an expected consequence of the new MATTER_CREATED/LINE_ADDED writers touching the same matter's log — same precedent 04-04 already established for this file."

requirements-completed: [STATE-05, STATE-02, AUDIT-01]

coverage:
  - id: D1
    description: "A correction after sign-off leaves the signed record byte-for-byte unchanged (deep-clone snapshot comparison), raises a second assessment under a freshly generated identifier, and moves the matter to SUPERSEDED through the guarded executor — both origins (SIGNED_OFF and CLOSED) wired"
    requirement: "STATE-05"
    verification:
      - kind: integration
        ref: "tests/routes/correction.test.ts#CORRECTION — 11 tests: verbatim-retention deep-equal snapshot, second-assessment shape (different id, PENDING lines, no sign-off, no final amount), matter moved to SUPERSEDED, exactly two assessments in write order, lookup-by-matter returns the newer one, preparer refusal (403), wrong-status refusal (409), success from CLOSED, one SUPERSEDED audit record, no import of recompute.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "A matter can be driven the whole way from draft to closed, around the information-request branch, entirely through the executor — proven by one test asserting the ordered sequence of recorded event types as a single comparison"
    requirement: "STATE-02"
    verification:
      - kind: integration
        ref: "tests/routes/lifecycle.test.ts#LIFECYCLE: a matter can be driven the whole way from draft to closed... — asserts status after every step and the full 16-event ordered type sequence in one comparison"
        status: pass
    human_judgment: false
  - id: D3
    description: "Marking the requestor notice as sent closes the matter through the guarded executor, and the figure stays visible to the preparer afterwards"
    requirement: "STATE-02"
    verification:
      - kind: integration
        ref: "tests/routes/lifecycle.test.ts#LIFECYCLE — mark-sent success+CLOSED+audit record, read-after-close asserts the actual finalAmount (18640), refusal before sign-off writes no record, second mark-sent refused"
        status: pass
      - kind: integration
        ref: "tests/routes/hr-result.test.ts#HR-RESULT — pre-existing suite, unedited, still passes with the widened SIGNED_OFF/CLOSED read"
        status: pass
    human_judgment: false
  - id: D4
    description: "Creating a matter and adding, editing or deleting a cost line each leave an audit record naming the entity and its changed values; a refused edit records nothing"
    requirement: "AUDIT-01"
    verification:
      - kind: integration
        ref: "tests/routes/lifecycle.test.ts#LIFECYCLE — MATTER_CREATED naming the matter and birth status; LINE_ADDED/LINE_EDITED/LINE_DELETED each naming the line; a refused post-draft edit writes no record and leaves the stored line unchanged"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every one of the 17 closed audit event types is accounted for as either written this phase or deliberately deferred with a named reason, and the phase's validation record is fully populated with nyquist_compliant: true"
    requirement: "AUDIT-01"
    verification:
      - kind: integration
        ref: "tests/routes/lifecycle.test.ts#LIFECYCLE: every audit event type is accounted for... — 14 written + 3 deferred (DISPOSITION_UNDONE, FLAG_ACKNOWLEDGED, CAPABILITY_STATEMENT_ACKNOWLEDGED), asserted as whole lists against the closed enumeration"
        status: pass
      - kind: other
        ref: "04-VALIDATION.md — all 14 task rows across 5 plans plus the decision checkpoint marked green; sign-off checklist complete; nyquist_compliant: true"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-19
status: complete
---

# Phase 04 Plan 05: Correction, Closure, Intake Audit, and the Whole-Lifecycle Proof Summary

**A correction after sign-off raises a second assessment under a freshly generated identifier while the signed original is proven byte-for-byte unchanged; marking the notice sent now closes the matter through the guarded executor; matter creation and every line add/edit/delete are audited; and one whole-lifecycle test drives draft through closed and asserts the ordered event-type sequence in a single comparison.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3 (2 code commits + this metadata commit)
- **Files modified:** 9 (3 created, 6 modified in code; plus `.planning/` docs)

## Accomplishments

- `listAssessmentsByMatterId()` added to the assessment repository (interface + in-memory impl); `getAssessmentByMatterId()` now returns the LAST assessment written for a matter, not the first — identical behaviour with one assessment on file, diverging only once a correction exists
- `raiseCorrection()` in `apps/web/src/server/data/assessments.ts`: requires the reviewer role, refuses via the executor's SUPERSEDE row unless signed off or closed, reads the signed assessment and never rewrites it, and raises a second assessment under a freshly generated identifier (never the engine's own derived one, which would silently collide with the existing record). Deliberately does not call the in-place recompute module — the two are commented mirror images of each other. New `POST /api/assessments/[id]/supersede` route.
- `markNoticeSent` now asks the executor for the MARK_SENT destination (SIGNED_OFF -> CLOSED) and writes it, reversing 03.1-04's recorded deferral now that a guarded executor exists; `getSignedOffAssessmentForHr` widened to permit CLOSED alongside SIGNED_OFF so the preparer does not lose the figure the moment the matter closes; the HR result page's branch widened to match
- `createMatter`/`addExpenseLine`/`replaceExpenseLine`/`deleteExpenseLine` each now record a MATTER_CREATED/LINE_ADDED/LINE_EDITED/LINE_DELETED audit event naming the entity and its changed values (categoryCode/quantity/unit/unitRate/claimedAmount — free-text fields deliberately excluded); a refused edit writes nothing
- `tests/routes/correction.test.ts` (CORRECTION, 11 tests) and `tests/routes/lifecycle.test.ts` (LIFECYCLE, 9 tests) — the latter includes the whole-lifecycle test (draft → itemisation → submission → review → information-request branch and back → sign-off → notice-sent → closure) asserting status after every step and the full 16-event ordered type sequence in one comparison, plus the audit event-type coverage test (14 written vs. 3 deliberately deferred, against the closed 17-type enumeration)
- `04-VALIDATION.md` fully populated across all five plans in the phase, sign-off checklist complete, `nyquist_compliant: true` set

## Task Commits

1. **Task 1: A correction that supersedes without editing anything** — `0fe2000` (feat)
2. **Task 2: The closing transition, and the acts that build a claim** — `9962cc1` (feat) — includes `tests/routes/workflow-tracer.test.ts`'s event-count update, an expected consequence of the new writers, per 04-04's own precedent for this file
3. **Task 3: Close the phase honestly** — the audit event-type coverage test was written as part of `lifecycle.test.ts` in Task 2's commit (the file was authored once); `04-VALIDATION.md`, `REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md` and `WINDOWS.md` updates land in this plan's metadata commit below

**Plan metadata:** committed alongside this SUMMARY

_Checkpoint 04-05-CP was pre-resolved by the product owner ahead of execution (Option A, literal transcription) — not presented interactively, per this executor's prompt instructions. The tracked-blocker note it required (how a correction gets re-reviewed and re-signed, since PRD §5's SUPERSEDE row leaves SUPERSEDED with no outgoing transition) is filed as WINDOWS.md entry 9 and in STATE.md's Blockers/Concerns._

## Files Created/Modified

- `apps/web/src/server/repositories/interface.ts` — `listAssessmentsByMatterId()` added
- `apps/web/src/server/repositories/memory/assessment-repository.ts` — `listAssessmentsByMatterId()` implemented; `getAssessmentByMatterId()` returns the last match
- `apps/web/src/server/data/assessments.ts` — `raiseCorrection()` added; `getSignedOffAssessmentForHr` widened to SIGNED_OFF/CLOSED
- `apps/web/src/server/data/matters.ts` — `markNoticeSent` wired through the executor; `createMatter`/`addExpenseLine`/`replaceExpenseLine`/`deleteExpenseLine` each audited
- `apps/web/src/server/recompute.ts` — module note extended, pointing at `raiseCorrection()`
- `apps/web/app/api/assessments/[id]/supersede/route.ts` — new thin POST route
- `apps/web/app/(hr)/matters/[id]/page.tsx` — result branch widened to CLOSED
- `packages/audit/src/payload-builders.ts` — `supersededPayload`, `matterCreatedPayload`, `expenseLineAddedPayload`/`EditedPayload`/`DeletedPayload`
- `tests/routes/correction.test.ts` — new: CORRECTION suite, 11 tests
- `tests/routes/lifecycle.test.ts` — new: LIFECYCLE suite, 9 tests
- `tests/routes/workflow-tracer.test.ts` — event counts updated (2→4, 0→1)
- `.planning/phases/04-workflow-and-audit-backbone/04-VALIDATION.md` — fully populated, `nyquist_compliant: true`
- `.planning/REQUIREMENTS.md` — STATE-05 marked Complete
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/WINDOWS.md` — updated

## Decisions Made

See `key-decisions` in the frontmatter above. Summary: checkpoint pre-resolved to Option A; the correction and in-place-recompute modules are deliberate mirror images, never sharing an import; the closing transition now moves matters to CLOSED through the executor; the open re-review gap is tracked, not invented away.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Expected test-count drift] `tests/routes/workflow-tracer.test.ts` event counts**
- **Found during:** Task 2
- **Issue:** The pre-existing WORKFLOW-TRACER suite asserted exactly 2 (then 0) audit events for a matter's log; adding MATTER_CREATED and LINE_ADDED writers made those counts 4 and 1 respectively
- **Fix:** Updated both assertions, and added explicit per-type count assertions, following the identical precedent 04-04 already established for this same file when it added the COMPUTED event type
- **Files modified:** `tests/routes/workflow-tracer.test.ts`
- **Verification:** `pnpm vitest run --project routes -t "WORKFLOW-TRACER"` passes; full suite green
- **Committed in:** `9962cc1` (Task 2 commit)

**2. [Rule 1 - Test scoping] The `CORRECTION: raised from the closed status` test needed a CLOSED matter before Task 2's `markNoticeSent` wiring existed**
- **Found during:** Task 1
- **Issue:** Task 1's own behavior list requires proving the SUPERSEDE row's CLOSED origin, but `matters.ts` (where `markNoticeSent` lives) is outside Task 1's declared file scope, and at the time Task 1 was written `markNoticeSent` did not yet move the matter to CLOSED
- **Fix:** The test moves the matter to CLOSED directly through the repository for setup purposes (proving the guard-table row in isolation), rather than through the real notice-sent HTTP path — which Task 2's own `lifecycle.test.ts` exercises end to end
- **Files modified:** `tests/routes/correction.test.ts`
- **Verification:** `pnpm vitest run --project routes -t "CORRECTION"` passes
- **Committed in:** `0fe2000` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — expected consequences of this plan's own changes, not scope creep).
**Impact on plan:** Neither affects correctness or security; both were necessary to keep the plan's own tests honest about what they prove.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 04 (Workflow and Audit Backbone) is now complete — 5/5 plans. STATE-02, STATE-03, STATE-05, AUDIT-01, AUDIT-03, AUDIT-04 and BOUND-05 are all discharged (AUDIT-01's pack-activation clause and AUDIT-04 both structurally-only, with no admin caller yet — PACK-07, Phase 3.2). Only STATE-04 (database-level immutability) remains Pending, owned by Phase 3.2's real Postgres.
- `04-VALIDATION.md` is fully populated across all five plans, sign-off checklist complete, `nyquist_compliant: true`.
- **Genuine open gap, tracked not resolved:** PRD §5's SUPERSEDE row gives SUPERSEDED no outgoing transition, so a correction raised after sign-off cannot yet be reviewed or re-signed by a named lawyer under today's guard table. This needs a product-owner decision (a PRD amendment or equivalent) before a later phase builds that path. Tracked as WINDOWS.md entry 9 and in STATE.md's Blockers/Concerns.
- Full suite: 725/725 (up from the 705/705 baseline recorded at the start of plan 04-01). `pnpm run lint`, `pnpm run typecheck` and `pnpm run depcruise` all exit 0.
- `gsd-tools.cjs` remains unavailable in this worktree (same recurring gap as every prior plan since 03-03) — STATE.md/ROADMAP.md/REQUIREMENTS.md/WINDOWS.md updated manually again this plan.
- Ready for `/gsd-plan-phase 5` (HR Intake and Disclosure Shell) and `/gsd-verify-work 04`.

## Self-Check: PASSED

All created files verified present on disk (`apps/web/app/api/assessments/[id]/supersede/route.ts`, `tests/routes/correction.test.ts`, `tests/routes/lifecycle.test.ts`); both task commit hashes (`0fe2000`, `9962cc1`) verified present in git history; full suite (725/725), lint, typecheck and depcruise all re-verified green immediately before writing this summary.

---
*Phase: 04-workflow-and-audit-backbone*
*Completed: 2026-09-19*
