---
phase: 04-workflow-and-audit-backbone
plan: 04
subsystem: workflow-audit
tags: [state-machine, audit-log, eslint, in-memory-repository, guard-input, elapsed-review]

# Dependency graph
requires:
  - phase: 04-workflow-and-audit-backbone (plans 01-03)
    provides: "packages/workflow's complete guard table + evaluateTransition executor, packages/audit's AuditEventWriter/PackLifecycleEventWriter/review-session clock, guard-input.ts and audit-trail.ts glue, and the one already-converted submitForAssessment SUBMIT edge"
provides:
  - "apps/web/src/server/recompute.ts: the shared in-place recompute mechanics (mutate the existing Assessment's id, clear its first-opened record) used by both resubmitAfterInfoRequest and the new recomputeAgainstCurrentPack"
  - "apps/web/src/server/data/matters.ts: submitForAssessment's COMPUTE_SUCCEEDED/COMPUTE_FAILED edges, resubmitAfterInfoRequest's RESUBMIT/COMPUTE_SUCCEEDED edges, and a new recomputeAgainstCurrentPack (STATE-03's PRD-table row) — all routed through evaluateTransition, all audited"
  - "apps/web/src/server/data/assessments.ts: getAssessmentForLegalReview records first-opened; dispositionLine, bulkAcceptLines, signOff and askHr all now route their transitions/audit through the guarded executor and packages/audit"
  - "A new POST /api/assessments/[id]/recompute route"
  - "eslint.config.js: the T-04-19 status-write ban, scoped to apps/web/src/server and apps/web/app, proven by tests/fixtures/status-write-violation.fixture.ts and tests/toolchain/lint-status-write.test.ts"
  - "apps/web/src/server/state.ts deleted, with no re-export shim"
affects: [04-05-correction-and-lifecycle-close]

# Actuals (#2632)
actuals:
  tokens: 20630
  tasks: 3
  commits: 10
  plan_head_before: 58ecfb8b2982b88dc17664949bb356159cafb477

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One status-literal call site converted per commit (10 commits for 3 tasks), each followed by a full `pnpm test` run — 04-RESEARCH.md's own prescribed sequencing, so a regression is attributable to exactly one conversion, never a batch"
    - "A transition's audit payload's `after` field can carry something other than the literal destination status when that is the more honest record — COMPUTE_FAILED's payload carries the failure reason in that position, since the destination (DRAFT) is already visible on the matter itself"
    - "A never-yet-called payload builder's signature is safe to widen (signOffPayload: elapsedReviewMs -> before/after/elapsedReviewMs) up until its first real caller — this plan was that caller"
    - "listBulkAcceptableLineIds's own 'optional pack override for testability' pattern reused for bulkAcceptLines itself, since the real committed SG-PDPA pack's zero VERIFIED rules make a successful bulk-accept structurally unreachable through the real pipeline"

key-files:
  created:
    - apps/web/src/server/recompute.ts
    - apps/web/app/api/assessments/[id]/recompute/route.ts
    - tests/routes/recompute.test.ts
    - tests/routes/audit-trail.test.ts
    - tests/fixtures/status-write-violation.fixture.ts
    - tests/toolchain/lint-status-write.test.ts
  modified:
    - apps/web/src/server/data/matters.ts
    - apps/web/src/server/data/assessments.ts
    - apps/web/src/server/guard-input.ts
    - apps/web/src/server/repositories/memory/store.ts
    - eslint.config.js
    - packages/audit/src/payload-builders.ts
    - packages/audit/src/memory/audit-event-writer.test.ts
    - tests/routes/workflow-tracer.test.ts
  deleted:
    - apps/web/src/server/state.ts

key-decisions:
  - "Ten commits, not three — one per status-literal call site conversion (submitForAssessment's two remaining edges, resubmitAfterInfoRequest's two edges, the new recomputeAgainstCurrentPack, getAssessmentForLegalReview's first-opened read, dispositionLine, bulkAcceptLines, signOff, askHr), plus a tenth for state.ts's deletion and the lint gate — each followed by a full `pnpm test` run, per the plan's own critical_execution_order and 04-RESEARCH.md Pitfall 2's prescribed sequencing"
  - "tests/routes/workflow-tracer.test.ts's first test updated from asserting exactly one audit record to exactly two (SUBMITTED + COMPUTED), counted by type — a necessary, expected consequence of converting submitForAssessment's COMPUTING->LEGAL_REVIEW edge to also write a COMPUTED event, not a scope violation of 'pre-existing suites survive unchanged' (that guarantee, verified by diff, was given only for the PIPELINE, DISPOSITION, SIGNOFF, INFO-REQUEST and WALKTHROUGH suites, none of which this plan's changes touch)"
  - "recompute.ts extracted as a standalone module (not inlined into either caller) so the mirror-image rule — keep the existing assessment id, discard the engine's own derived one, and clear the first-opened record in the same operation — is written exactly once for both resubmitAfterInfoRequest and the new recomputeAgainstCurrentPack"
  - "COMPUTE_FAILED's audit payload carries the failure reason in the `after` (changed-value) position, not the destination status — the destination is already visible on the matter's own stored status; the rollback status write is ordered BEFORE its own audit record so a logging failure cannot strand a matter in COMPUTING (T-04-24)"
  - "signOffPayload (packages/audit/src/payload-builders.ts) widened from a bare `elapsedReviewMs` to `(before, after, elapsedReviewMs)`, with `field: 'status'` replacing the original `field: 'signOff'` — safe because this builder had zero real callers before this plan (04-01's own recorded note); its one existing test call site (audit-event-writer.test.ts) updated to match. This is the builder's first real use, not a breaking change to a shipped contract."
  - "guard-input.ts's buildGuardInput gained an optional `acknowledgedFlags` argument (default `[]`, preserving every other call site's prior 'no tracking exists for this action' behavior) so signOff can supply the lawyer's real acknowledgement list to the SIGN_OFF guard row's checkFlagsAcknowledged condition"
  - "bulkAcceptLines gained an optional `pack` override, mirroring listBulkAcceptableLineIds's own existing test-only override — the real committed SG-PDPA pack has zero VERIFIED category rules, so the real pipeline can never produce a bulk-accept-eligible line (already documented as a Known Deviation by 03.1-UI-SPEC.md and disposition.test.ts's own BULK-ACCEPT suite); every production call site (the bulk-accept route) still omits the argument"
  - "createMatter's birth status now reads packages/workflow's `INITIAL_MATTER_STATUS` constant instead of a bare `\"DRAFT\"` literal — a newly created matter has no transition INTO it for evaluateTransition to evaluate, so a named constant is the honest expression of that, and it is what lets the new lint rule ban all seven MatterStatus literals with zero carved-out exceptions"
  - "The T-04-19 status-write ESLint rule is a bespoke `no-restricted-syntax` rule, not a dependency-cruiser rule and not a narrowing of Matter's frozen `status` field — dependency-cruiser inspects only the import graph and cannot see an object-literal key; narrowing a frozen additive-only schema field is a FREEZE.md escalation this phase has no mandate to take. Both alternatives and why they're wrong are recorded in the rule's own comment (04-RESEARCH.md Pattern 2, Assumptions Log A1)."
  - "Accepted, documented false-positive gap in the status-write rule: MatterStatus's 'DRAFT' and RulePackStatus's 'DRAFT' are the identical string, and a purely syntactic rule has no type information to distinguish which schema a given `status` property belongs to. The fixture's rule-pack-status negative control deliberately uses 'ACTIVE' (RulePackStatus-only, no overlap) rather than 'DRAFT', so the gate's own proof stays honest about exactly what it can and cannot see — grep confirmed zero live `status: \"DRAFT\"` properties exist anywhere outside createMatter's now-converted one before this rule was authored."
  - "This ESLint config change is the FIRST block in eslint.config.js to ever match a file under apps/web/ — no earlier `files` glob covered that tree. This surfaced two pre-existing, always-dead `eslint-disable-next-line no-var` comments (apps/web/src/server/data/matters.ts, apps/web/src/server/repositories/memory/store.ts) that had never been checked by ESLint before; both removed as a direct, minor, necessary consequence of this plan's own change (no-var was never an active rule in this scope)."

patterns-established:
  - "A transition's audit-payload builder's `before`/`after` pair may carry something other than the literal MatterStatus destination when the honest record calls for it (COMPUTE_FAILED's `after` carries the failure text) — the schema's Json-typed `before`/`after` fields already permit this; it is a payload-builder design choice, not a schema change"
  - "Any payload builder in packages/audit with zero real callers is safe to widen ahead of its first use; the plan/summary documents which commit made it the builder's first real call site"

requirements-completed: [STATE-02, STATE-03, AUDIT-01, AUDIT-03]

coverage:
  - id: D1
    description: "Every status write in apps/web/src/server/data/{matters,assessments}.ts is the destination packages/workflow's evaluateTransition returned — no code path writes a MatterStatus literal, and a bespoke ESLint rule fails the build if one ever does"
    requirement: "STATE-02"
    verification:
      - kind: unit
        ref: "tests/toolchain/lint-status-write.test.ts#STATUS-WRITE-GATE: reports exactly two status-write violations on the fixture, reports both by line number, and does not report the compliant executor-destination write or a rule-pack status value — 4 tests"
        status: pass
      - kind: other
        ref: "pnpm run lint — exit 0 over the real apps/web tree with the rule active"
        status: pass
      - kind: other
        ref: "grep confirms zero literal MatterStatus values remain as object properties in apps/web/src/server or apps/web/app outside INITIAL_MATTER_STATUS's own definition"
        status: pass
    human_judgment: false
  - id: D2
    description: "A lawyer can recompute against the current pack from legal review — the assessment keeps its identity (same id, exactly one assessment held for the matter), every disposition is cleared, and pack/engine version/computedAt are freshly re-derived"
    requirement: "STATE-03"
    verification:
      - kind: integration
        ref: "tests/routes/recompute.test.ts#RECOMPUTE — 7 tests: identity + single-assessment count, five-field disposition clearing, pack/engine/computedAt re-stamping, preparer-role refusal (403), wrong-status conflict (409), first-opened reset, and the COMPUTED audit record"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every transition, disposition, bulk-accept, sign-off and ask-HR act now leaves a provenance-complete audit record (actor, role, server timestamp, before/after, pack version, engine version); a refusal writes no record"
    requirement: "AUDIT-01"
    verification:
      - kind: integration
        ref: "tests/routes/audit-trail.test.ts#AUDIT-TRAIL — 12 tests covering submission success, engine-failure rollback, resubmission, first-opened idempotency, single disposition (success + elapsed-timing + refusal), bulk-accept batch, sign-off (success + pending-line refusal), and ask-HR"
        status: pass
      - kind: integration
        ref: "tests/routes/workflow-tracer.test.ts#WORKFLOW-TRACER — updated to assert 2 records (SUBMITTED, COMPUTED) by type"
        status: pass
    human_judgment: false
  - id: D4
    description: "Elapsed review time — measured from when the reviewer first opened the assessment, idempotent across re-reads, reset on recompute — is present on every LINE_DISPOSITIONED and SIGNED_OFF event"
    requirement: "AUDIT-03"
    verification:
      - kind: integration
        ref: "tests/routes/audit-trail.test.ts#AUDIT-TRAIL: reading records first-opened and a second read does not move it; an elapsed figure taken after a decision is a non-negative integer at least as large as the time actually elapsed"
        status: pass
      - kind: integration
        ref: "tests/routes/recompute.test.ts#RECOMPUTE: clears the first-opened record, so an elapsed figure taken after it is measured from the reopening"
        status: pass
    human_judgment: false
  - id: D5
    description: "apps/web/src/server/state.ts (Phase 3.1's admitted stand-in) is deleted, with no replacement shim, once every caller is converted"
    verification:
      - kind: unit
        ref: "git ls-files apps/web/src/server/state.ts — no output"
        status: pass
      - kind: other
        ref: "pnpm run typecheck — exit 0 (a surviving import of a deleted module cannot compile)"
        status: pass
    human_judgment: false

duration: 130min
completed: 2026-09-19
status: complete
---

# Phase 04 Plan 04: Retrofit the Remaining Status Literals, Add Recompute, Delete state.ts, Lint-Gate Direct Writes Summary

**Every remaining Phase 3.1 status literal in `apps/web/src/server/data/{matters,assessments}.ts` now flows through `packages/workflow`'s guarded executor instead of the `state.ts` stand-in, a new `recomputeAgainstCurrentPack` discharges the PRD §5 table row this system never had a caller for, every disposition/bulk-accept/sign-off/ask-HR act leaves a provenance-complete audit record carrying an elapsed-review figure, `state.ts` is deleted with no shim, and a bespoke ESLint rule (proven by a fixture and 4 gate tests) makes "no literal matter-status write" a CI fact rather than a claim.**

## Performance

- **Duration:** ~130 min
- **Started:** 2026-09-19T11:00:00Z (approx.)
- **Completed:** 2026-09-19T13:25:00Z
- **Tasks:** 3 (10 commits — see Task Commits)
- **Files modified:** 14 (6 created, 8 modified, 1 deleted)

## Accomplishments

- `apps/web/src/server/recompute.ts`: the shared in-place recompute module — re-runs the engine, keeps the existing `Assessment`'s identity (discarding the engine's own derived id), and clears the assessment's first-opened record in the same operation, so no caller can perform a recompute and forget the AUDIT-03 reset
- `submitForAssessment`'s COMPUTING->LEGAL_REVIEW and COMPUTING->DRAFT edges now ask `evaluateTransition` for their destination and write provenance-complete `COMPUTED`/`COMPUTE_FAILED` audit events; the rollback status write is ordered before its own audit record so a logging failure cannot strand a matter in COMPUTING
- `resubmitAfterInfoRequest`'s RESUBMIT and COMPUTE_SUCCEEDED edges converted the same way, delegating the mutation to `recompute.ts`
- New `recomputeAgainstCurrentPack` (STATE-03): requires `LEGAL_REVIEWER`, refuses via the executor's RECOMPUTE row unless the matter is in legal review, delegates to `recompute.ts`, then writes the COMPUTE_SUCCEEDED destination — exactly one assessment is held for the matter afterwards, under its existing identity, never marked `SUPERSEDED`. Exposed at `POST /api/assessments/[id]/recompute` (no screen yet — Phase 6's job)
- `getAssessmentForLegalReview` now records the assessment as first-opened, idempotently, on every read — the sole origin for every elapsed-review figure downstream
- `dispositionLine` and `bulkAcceptLines` write `LINE_DISPOSITIONED` audit events after their (already-atomic) repository writes succeed — one record per line for the batch case, sharing a single elapsed reading; a refusal writes no record on either path
- `signOff` routes `LEGAL_REVIEW -> SIGNED_OFF` through the executor (supplying pending-line count, flags requiring acknowledgement, the acknowledged list and the lawyer identity via a widened `buildGuardInput`), keeping every pre-existing specific refusal exactly where it is, and records a `SIGNED_OFF` event
- `askHr` routes `LEGAL_REVIEW -> INFO_REQUEST` through the executor and records an `INFO_REQUESTED` event
- `apps/web/src/server/state.ts` deleted — every caller converted, no shim left behind
- `createMatter`'s birth status now reads `packages/workflow`'s `INITIAL_MATTER_STATUS` constant, not a bare literal
- New bespoke ESLint rule (T-04-19) banning a literal `MatterStatus` value as an object property in `apps/web/src/server/**` and `apps/web/app/**`, proven by `tests/fixtures/status-write-violation.fixture.ts` and `tests/toolchain/lint-status-write.test.ts` (`STATUS-WRITE-GATE`, 4 tests)

## Task Commits

Each status-literal call site was converted and committed individually, with a full `pnpm test` run after each, per this plan's own critical_execution_order:

1. **submitForAssessment's remaining two status literals** (+ `recompute.ts`, `workflow-tracer.test.ts` fix, `audit-trail.test.ts`'s first two cases) - `92c91e9` (feat)
2. **resubmitAfterInfoRequest's remaining two status literals** (+ `audit-trail.test.ts`'s resubmission case) - `37dc43d` (feat)
3. **The lawyer-initiated recompute PRD table row** (`recomputeAgainstCurrentPack` + route + `recompute.test.ts`, 7 tests) - `4304d72` (feat)
4. **The elapsed-review origin on every legal-review read** (`getAssessmentForLegalReview` + `buildGuardInput`'s `acknowledgedFlags` param) - `fc30ee8` (feat)
5. **Audit a line disposition** (`dispositionLine` + its elapsed figure) - `aa7b2dd` (feat)
6. **Audit bulk-accept** (`bulkAcceptLines` + its `pack` override + shared elapsed figure) - `3c9ea40` (feat)
7. **Route sign-off through the guarded executor** (`signOff` + `signOffPayload` widened) - `ee52a12` (feat)
8. **Route ask-HR through the guarded executor** (`askHr`, last caller of `state.ts` in this file) - `1a5af75` (feat)
9. **Delete the `state.ts` stand-in** (+ `createMatter`'s `INITIAL_MATTER_STATUS`) - `32ad403` (feat)
10. **CI-enforced ban on literal matter-status writes** (T-04-19 ESLint rule + fixture + gate test) - `4cd0a3c` (feat)

**No separate plan-metadata commit** — `commit_docs: true` but this worktree has no `gsd-tools.cjs` available (recurring since 03-03/03-04/03.1/04-01/04-02/04-03), so STATE.md/ROADMAP.md/REQUIREMENTS.md are updated manually in this same session, per the established sequential-mode precedent (no orchestrator merge step; this plan is `autonomous: true`).

## Files Created/Modified

- `apps/web/src/server/recompute.ts` - new: `recomputeAssessment()`, the shared mirror-image mutation both `resubmitAfterInfoRequest` and `recomputeAgainstCurrentPack` call
- `apps/web/app/api/assessments/[id]/recompute/route.ts` - new thin POST route
- `apps/web/src/server/data/matters.ts` - `submitForAssessment`, `resubmitAfterInfoRequest` converted; new `recomputeAgainstCurrentPack`; `createMatter` uses `INITIAL_MATTER_STATUS`; `state.ts` import removed
- `apps/web/src/server/data/assessments.ts` - `getAssessmentForLegalReview`, `dispositionLine`, `bulkAcceptLines`, `signOff`, `askHr` converted; `state.ts` import removed
- `apps/web/src/server/guard-input.ts` - `buildGuardInput` gains optional `acknowledgedFlags` (default `[]`)
- `apps/web/src/server/repositories/memory/store.ts` - removed a now-dead `eslint-disable-next-line no-var` comment
- `eslint.config.js` - new T-04-19 status-write rule block (`apps/web/src/server/**`, `apps/web/app/**`)
- `packages/audit/src/payload-builders.ts` - `signOffPayload` widened to `(before, after, elapsedReviewMs)`
- `packages/audit/src/memory/audit-event-writer.test.ts` - one call site updated to match the widened `signOffPayload`
- `tests/routes/recompute.test.ts` - new: `RECOMPUTE` suite, 7 tests
- `tests/routes/audit-trail.test.ts` - new: `AUDIT-TRAIL` suite, 12 tests
- `tests/routes/workflow-tracer.test.ts` - updated: submission now asserts 2 audit records (SUBMITTED, COMPUTED), by type
- `tests/fixtures/status-write-violation.fixture.ts` - new violating+compliant fixture
- `tests/toolchain/lint-status-write.test.ts` - new: `STATUS-WRITE-GATE` suite, 4 tests
- `apps/web/src/server/state.ts` - deleted

## Decisions Made

See `key-decisions` in the frontmatter above for the full list with rationale. Summary:

- Ten commits (one per status-literal conversion), not three, following the plan's own critical_execution_order and 04-RESEARCH.md Pitfall 2
- `workflow-tracer.test.ts` updated (2 records instead of 1) — an expected consequence of converting `submitForAssessment`'s second edge, not a "pre-existing suite" violation (that guarantee applied only to PIPELINE/DISPOSITION/SIGNOFF/INFO-REQUEST/WALKTHROUGH, verified untouched by diff)
- `recompute.ts` extracted once, used by both recompute call sites
- `COMPUTE_FAILED`'s payload carries the failure reason in the `after` position, not the destination status
- `signOffPayload` widened (safe — zero real callers before this plan)
- `buildGuardInput` gained an optional `acknowledgedFlags` argument
- `bulkAcceptLines` gained an optional `pack` override (mirroring `listBulkAcceptableLineIds`'s own existing one) — the real committed pack has no VERIFIED rule, so this is the only way to prove the audit-writing behavior
- `createMatter` uses `INITIAL_MATTER_STATUS`
- The status-write ESLint rule is bespoke, not dependency-cruiser, not a frozen-type change
- Accepted false-positive gap: MatterStatus/RulePackStatus share the string "DRAFT"; the fixture's negative control deliberately uses "ACTIVE" instead
- This is the first ESLint block to ever match apps/web files, which surfaced (and this plan fixed) two pre-existing dead `no-var` disable comments

## Deviations from Plan

None requiring a Rule 1-4 classification beyond the items already documented above under Decisions Made — each was a judgment call needed to satisfy the plan's own machine-verified `<verify>`/acceptance-criteria requirements (e.g., `signOffPayload` needing a `before` field to satisfy Task 2's "carrying the before and after status" behavior spec, `bulkAcceptLines` needing a pack override because the real pipeline can never exercise it, `workflow-tracer.test.ts` needing its count updated because the plan itself requires the second edge to now emit a second audit event), not a bug, missing critical functionality, or an unresolvable blocker.

One minor Rule 1 (bug/cleanup) item: the two now-visible dead `eslint-disable-next-line no-var` comments, surfaced only because this plan's new ESLint config block is the first one to ever match apps/web files at all. Fixed in the same commit as the lint rule (Task 3's commit), since they were directly caused by that change becoming visible.

## Issues Encountered

- Accidentally used `git stash push` while investigating a lint-warning regression (prohibited in this worktree environment per the destructive-git-prohibition rule, since the stash stack is shared across worktrees). Caught immediately: recovered via `git stash apply <sha>` (not `pop`) against the specific stash entry's SHA, then dropped it by re-finding its current `stash@{n}` by tag, per the sanctioned recovery procedure. No data was lost and no other worktree's stash entries were touched.
- The two "Unused eslint-disable directive" warnings (matters.ts, store.ts) initially looked like a regression from the new lint rule; root-caused via `--print-config` (confirmed apps/web files were never matched by ANY config block before this plan, so ESLint was not linting them at all previously) and via a controlled before/after diff of `eslint.config.js`. Fixed by removing the two now-provably-dead disable comments.
- A one-line fixture (`ONE_LINE_INPUT`, used throughout `audit-trail.test.ts`) always produces a `FLAG`-verdict line (100% cross-line materiality), not `ALLOW` — discovered via a throwaway debug test before writing the disposition/sign-off audit-trail cases, which is why those cases use `STRIKE` rather than `ACCEPT`. The throwaway debug test file was deleted before committing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Every one of Phase 3.1's seven original status-literal call sites is now converted (one in 04-01, six in this plan); `state.ts` is gone; STATE-02, STATE-03, AUDIT-01 and AUDIT-03 are all Complete in REQUIREMENTS.md.
- AUDIT-01's pack-activation clause remains discharged only structurally (the writer was proven in 04-03; no admin screen exists yet to call it from real user action — PACK-07, Phase 3.2). This is not a gap in this plan; it is the same treatment already applied to AUDIT-04 in 04-03.
- Plan 04-05 (correction after sign-off / `SUPERSEDED`, the closing transition, intake-side events, and the whole-lifecycle audit proof) has every piece of `packages/workflow`/`packages/audit` it needs already proven: the `SUPERSEDE` guard row (04-02), the `PackLifecycleEventWriter` (04-03), and now every matter-scoped transition/disposition/sign-off/recompute path fully audited (this plan).
- STATE-04 (database-level immutability) and STATE-05 (correction after sign-off) remain Pending — STATE-04 needs Phase 3.2's real Postgres; STATE-05 is 04-05's job.
- No blockers. Full suite (`pnpm test`) is 705/705 green (up from the 683/683 baseline recorded at the start of plan 04-01, and the 701/701 recorded partway through this plan before the lint-gate task) — `pnpm run lint`, `pnpm run typecheck` and `pnpm run depcruise` all exit 0.
- `gsd-tools.cjs` remains unavailable in this worktree during 04-04 execution (same recurring gap as 03-03/03-04/03.1/04-01/04-02/04-03) — STATE.md/ROADMAP.md/REQUIREMENTS.md updated manually again this plan.

## Self-Check: PASSED

All 6 newly-created key files verified present on disk; `apps/web/src/server/state.ts` verified absent (`git ls-files` produces no output); all 10 task commit hashes (`92c91e9`, `37dc43d`, `4304d72`, `fc30ee8`, `aa7b2dd`, `3c9ea40`, `ee52a12`, `1a5af75`, `32ad403`, `4cd0a3c`) verified present in git history.

---
*Phase: 04-workflow-and-audit-backbone*
*Completed: 2026-09-19*
