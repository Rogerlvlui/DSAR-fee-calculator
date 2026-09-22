---
phase: 04-workflow-and-audit-backbone
plan: 01
subsystem: workflow-audit
tags: [zod, vitest, state-machine, audit-log, in-memory-repository, guard-input]

# Dependency graph
requires:
  - phase: 03.1-demo-slice-in-memory-determination-pipeline
    provides: the seven hand-written status-literal call sites this plan begins retrofitting (one converted here), the memory-repository deep-copy pattern this plan's audit store copies, and the demo-coerced pack this plan's guard input is fed from
provides:
  - "packages/workflow: pure guarded executor (evaluateTransition) over the frozen GuardInput, with one row (DRAFT --SUBMIT--> COMPUTING) carrying the full PRD §5 guard list"
  - "packages/audit: in-memory AuditEventWriter (append/listByMatter/exportAll), the pack-lifecycle writer interface (declared, not implemented), payload builders for transition/disposition/sign-off/information-request, and the ephemeral review-session first-opened clock"
  - "apps/web/src/server/guard-input.ts and audit-trail.ts: the server-side glue assembling GuardInput and recording matter-scoped audit events"
  - "submitForAssessment (apps/web/src/server/data/matters.ts) converted to write the guarded executor's own returned destination and record a provenance-complete SUBMITTED audit event"
affects: [04-02-transition-table-completion, 04-03-pack-lifecycle-writer, 04-04-remaining-call-site-retrofit, 04-05-correction-and-lifecycle-close]

# Actuals (#2632)
actuals:
  tokens: 12568
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Declared TRANSITIONS array (TransitionSpec[]) with a guard predicate per row, following DERIVED_MATTER_FLAG_SPECS/ACTIVE_READY_CHECKS precedent — diffable row-by-row against PRD §5"
    - "globalThis-anchored audit store with the monotonic id counter living in the SAME anchored object as the events, mirroring apps/web's demoStore pattern"
    - "Zero-padded monotonic string ids for lexicographic == chronological ordering, immune to same-millisecond timestamp collisions"
    - "Typed payload builder functions over a single frozen z.strictObject payload schema, so an undeclared key fails the type check before the runtime rejection"
    - "Elapsed-review enforcement lives at the writer (memory/audit-event-writer.ts), not at a call site, so AUDIT-03's requirement cannot be forgotten by a future caller"

key-files:
  created:
    - packages/workflow/src/transitions.ts
    - packages/workflow/src/evaluate-transition.ts
    - packages/audit/src/interface.ts
    - packages/audit/src/payload-builders.ts
    - packages/audit/src/memory/store.ts
    - packages/audit/src/memory/audit-event-writer.ts
    - packages/audit/src/review-session.ts
    - apps/web/src/server/guard-input.ts
    - apps/web/src/server/audit-trail.ts
    - tests/routes/workflow-tracer.test.ts
  modified:
    - apps/web/src/server/data/matters.ts
    - package.json
    - apps/web/package.json
    - tsconfig.json
    - vitest.config.ts

key-decisions:
  - "GuardInput.pack's 'past its review date' condition is resolved via pack.status === 'STALE' (already downgraded upstream by the rulepacks loader's deriveEffectiveStatus), not by the guard reading a clock — GuardInput's frozen 11-member shape has no `now` field, and the guard must stay pure"
  - "submitForAssessment's two pre-existing 03.1 ValidationError checks (DRAFT-only, at-least-one-line) were left untouched; only the literal `assertTransition(matter.status, \"COMPUTING\")` call — the plan's own named 'first stand-in transition check' — was replaced by the guarded executor. Removing the pre-existing checks would flip the zero-line case's response from 400 to 409, breaking the already-passing, must-survive-unchanged PIPELINE-tagged demo-pipeline.test.ts (a machine-verified <verify> requirement). The guard's identical 'at least one expense line' condition is proven directly and separately in evaluate-transition.test.ts"
  - "'the writer's export is still empty afterwards' (Task 1/2 acceptance criteria) is asserted via listByMatter(matterId) scoped to the matter under test, not literally AuditEventWriter.exportAll() — the audit store is a globalThis-anchored singleton shared across every test in a file, so by the time a later test runs, exportAll() already reflects earlier tests' unrelated events. Per-matter emptiness is the meaningful, testable claim"
  - "@dsar/engine added to the ROOT package.json dependencies (previously only apps/web and packages/rulepacks depended on it) — tests/routes/workflow-tracer.test.ts imports @dsar/engine's ENGINE_VERSION directly from the repo root, which cannot resolve through apps/web's own node_modules symlink (same fix 03.1-05 already made for @dsar/rulepacks)"
  - "informationRequestPayload (packages/audit/src/payload-builders.ts) is new design not itemized in the plan's code example — entityId names the assessment line, field:'infoRequest', after: the query text, no before value. A reasonable, minimal shape against the already-frozen five-key payload schema; not exercised by any real call site until plan 04-04"

patterns-established:
  - "Guarded transition call sites replace only the literal transition-check call, leaving surrounding pre-existing validation checks untouched, one function at a time — Pitfall 2's prescribed sequencing for the remaining six call sites in 04-04"

requirements-completed: []  # STATE-02, AUDIT-01, AUDIT-03, BOUND-05 each only partly discharged by this plan (one of nine transition rows; matter-scoped writer only, not pack-lifecycle; elapsed-clock built but not yet wired to a real disposition/sign-off call site; payload closed-set enforced end to end for the one event type this plan writes)

coverage:
  - id: D1
    description: "A real submission moves a matter out of DRAFT only because the guarded executor (evaluateTransition) returned a permitted destination, and the status written is that destination, not a literal chosen by the caller"
    requirement: "STATE-02"
    verification:
      - kind: integration
        ref: "tests/routes/workflow-tracer.test.ts#WORKFLOW-TRACER: a permitted submission writes the executor's own destination and exactly one provenance-complete audit record"
        status: pass
      - kind: unit
        ref: "packages/workflow/src/evaluate-transition.test.ts#GUARD-TABLE: permits SUBMIT for a matter satisfying every condition, returning COMPUTING as the destination"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same submission leaves behind an audit record carrying the acting user, role, server timestamp, before/after status, rule pack version and engine version"
    requirement: "AUDIT-01"
    verification:
      - kind: integration
        ref: "tests/routes/workflow-tracer.test.ts#WORKFLOW-TRACER: a permitted submission writes the executor's own destination and exactly one provenance-complete audit record"
        status: pass
    human_judgment: false
  - id: D3
    description: "An audit payload carrying a key outside the frozen declared set is refused by the writer, not silently stored or stripped"
    requirement: "BOUND-05"
    verification:
      - kind: unit
        ref: "packages/audit/src/memory/audit-event-writer.test.ts#AUDIT-WRITER: refuses a payload carrying a key outside the declared set, and nothing is stored"
        status: pass
    human_judgment: false
  - id: D4
    description: "A caller mutating an event handed back by the writer cannot reach into the stored record (deep-copy isolation on write, read, and export)"
    verification:
      - kind: unit
        ref: "packages/audit/src/memory/audit-event-writer.test.ts#AUDIT-WRITER: stores an event, returns a deep copy, and a caller mutating the returned object leaves the stored record unchanged"
        status: pass
      - kind: unit
        ref: "packages/audit/src/memory/audit-event-writer.test.ts#AUDIT-WRITER: exporting returns every matter's events in identifier order, and returns deep copies"
        status: pass
    human_judgment: false
  - id: D5
    description: "The writer refuses to append a LINE_DISPOSITIONED or SIGNED_OFF event with no elapsedReviewMs figure; the review-session clock records first-opened idempotently and reports zero, not absent, when never opened"
    requirement: "AUDIT-03"
    verification:
      - kind: unit
        ref: "packages/audit/src/memory/audit-event-writer.test.ts#AUDIT-WRITER: refuses a LINE_DISPOSITIONED event whose payload carries no elapsedReviewMs figure, and nothing is stored"
        status: pass
      - kind: unit
        ref: "packages/audit/src/memory/audit-event-writer.test.ts#AUDIT-WRITER: refuses a SIGNED_OFF event whose payload carries no elapsedReviewMs figure, and nothing is stored"
        status: pass
      - kind: unit
        ref: "packages/audit/src/review-session.test.ts#REVIEW-SESSION: the elapsed figure for an assessment never recorded as opened is exactly zero, and an integer"
        status: pass
    human_judgment: false
  - id: D6
    description: "The two new packages (@dsar/workflow, @dsar/audit) are reachable from the test runner, the type checker and the application, and the existing 03.1 demo pipeline still passes end to end unchanged"
    verification:
      - kind: integration
        ref: "tests/routes/demo-pipeline.test.ts (PIPELINE tag) — 3/3 passing, unchanged"
        status: pass
      - kind: other
        ref: "pnpm run typecheck — exit 0, both packages present as tsconfig.json project references"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-09-19
status: complete
---

# Phase 04 Plan 01: Guarded Submit Transition with Audited Provenance (Tracer) Summary

**One real HR submission now transitions a matter from DRAFT to COMPUTING only because `packages/workflow`'s pure guarded executor returned that destination, and leaves behind an in-memory, deep-copy-isolated, schema-validated audit record naming who did it, when, from what, to what, and against which rule pack and engine version.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-09-19T01:10:00Z (approx.)
- **Completed:** 2026-09-19T01:48:00Z
- **Tasks:** 3
- **Files modified:** 23 (14 created, 9 modified)

## Accomplishments

- New `packages/workflow` package: a declared `TRANSITIONS` array (one row, DRAFT --SUBMIT--> COMPUTING) with the full PRD §5 guard list for that row, and a pure `evaluateTransition(from, event, input)` executor that reads no clock, touches no repository, and performs no I/O
- New `packages/audit` package: an in-memory `AuditEventWriter` (append/listByMatter/exportAll) with monotonic zero-padded ids, deep-copy isolation on every read and write, and refusal of any payload carrying an undeclared key or a missing `elapsedReviewMs` figure on `LINE_DISPOSITIONED`/`SIGNED_OFF` events; the `PackLifecycleEventWriter` interface (D-21's separate stream) declared but not implemented; an ephemeral `review-session.ts` first-opened clock (idempotent, zero-not-absent, explicitly clearable)
- `apps/web/src/server/guard-input.ts` and `audit-trail.ts`: the server-side glue that assembles the frozen `GuardInput` from already-fetched values (fed the demo-coerced pack, documented in place) and records a server-timestamped, awaited audit event
- `submitForAssessment` converted: the literal `assertTransition(matter.status, "COMPUTING")` stand-in call is replaced by the guarded executor; the status written is the executor's own returned destination; a refusal throws a `ConflictError` carrying the guard's own reason
- `tests/routes/workflow-tracer.test.ts` proves the whole spine end to end over the real committed SG-PDPA pack: one submission, one audit record, every provenance field populated, matter status asserted separately from the audit record's before/after pair
- The existing 03.1 `PIPELINE`-tagged demo pipeline suite (`tests/routes/demo-pipeline.test.ts`) verified unchanged and still green

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "a submission is permitted, then recorded" — one path only** - `e826510` (feat)
2. **Task 2: The writer contract in full — listing, export, monotonic order, and the elapsed-review clock** - `524ee32` (feat)
3. **Task 3: Record what this plan settled, and what it deliberately left standing** - `d774acb` (docs)

_No separate plan-metadata commit — `commit_docs: true` but this worktree has no `gsd-tools.cjs` available (recurring since 03-03/03-04/03.1), so STATE.md/ROADMAP.md/REQUIREMENTS.md are updated manually in this same session and folded into this SUMMARY's own commit, per the established sequential-mode precedent._

## Files Created/Modified

- `packages/workflow/package.json`, `tsconfig.json` - new pure workspace package, `@dsar/schemas`-only dependency
- `packages/workflow/src/transitions.ts` - the declared `TRANSITIONS` array, `TransitionEvent` union, `INITIAL_MATTER_STATUS` constant
- `packages/workflow/src/evaluate-transition.ts` - the pure executor and `TransitionOutcome` type
- `packages/workflow/src/evaluate-transition.test.ts` - 9 GUARD-TABLE tests (no-match refusal, each of the 5 guard conditions, draft/withdrawn/stale distinguished, permitted case)
- `packages/audit/package.json`, `tsconfig.json` - new workspace package, `@dsar/schemas`-only dependency
- `packages/audit/src/interface.ts` - `AuditEventWriter`, `PackLifecycleEventWriter` (declared, not implemented), `NewAuditEvent`/`NewPackLifecycleEvent`
- `packages/audit/src/payload-builders.ts` - `transitionPayload`, `dispositionPayload`, `signOffPayload`, `informationRequestPayload`
- `packages/audit/src/memory/store.ts` - globalThis-anchored `auditStore` (events map + monotonic counter)
- `packages/audit/src/memory/audit-event-writer.ts` - the in-memory writer, elapsed-figure enforcement, monotonic zero-padded ids
- `packages/audit/src/memory/audit-event-writer.test.ts` - 9 AUDIT-WRITER tests
- `packages/audit/src/review-session.ts` - `recordAssessmentOpened`, `elapsedReviewMs`, `clearAssessmentOpened`
- `packages/audit/src/review-session.test.ts` - 3 REVIEW-SESSION tests
- `apps/web/src/server/guard-input.ts` - `buildGuardInput`, demo-coercion documented in place
- `apps/web/src/server/audit-trail.ts` - `recordAuditEvent`
- `apps/web/src/server/data/matters.ts` - `submitForAssessment` converted; two pre-existing checks and the two other edges left untouched
- `tests/routes/workflow-tracer.test.ts` - 2 WORKFLOW-TRACER tests (permitted, refused)
- `package.json`, `apps/web/package.json` - `@dsar/workflow`, `@dsar/audit`, `@dsar/engine` added as workspace dependencies
- `tsconfig.json` - `packages/workflow`, `packages/audit` registered as project references
- `vitest.config.ts` - `workflow` and `audit` node-environment test projects added

## Decisions Made

- GuardInput's "past its review date" condition reads `pack.status === "STALE"` rather than computing staleness from a clock — the frozen 11-member GuardInput has no `now` field, and the pack-status downgrade already happens upstream (rulepacks loader's `deriveEffectiveStatus`). This keeps `packages/workflow` genuinely clock-free.
- `submitForAssessment`'s two pre-existing 03.1 `ValidationError` checks (DRAFT-only, at-least-one-line) were deliberately left untouched, converting only the single literal `assertTransition(matter.status, "COMPUTING")` call the plan names as "the first stand-in transition check." This was necessary to keep `demo-pipeline.test.ts`'s hardcoded zero-line 400 assertion passing, per the plan's own machine-verified requirement that the PIPELINE suite survive unchanged. The guard's own identical zero-line condition is proven directly in `evaluate-transition.test.ts`.
- "The writer's export is still empty afterwards" (plan's acceptance criteria for the undeclared-key and elapsed-figure refusal tests) is asserted via `listByMatter(matterId)` scoped to the matter under test, not literally `exportAll()` — the audit store is a shared globalThis singleton across every test in a file, so `exportAll()` accumulates unrelated events from earlier tests in the same run.
- `@dsar/engine` added to the root `package.json` (previously only `apps/web`/`packages/rulepacks` depended on it) — the new root-level test imports `ENGINE_VERSION` directly and cannot resolve it through `apps/web`'s own `node_modules` symlink, the same fix already applied to `@dsar/rulepacks` in 03.1-05.
- `informationRequestPayload` is new design (not itemized in 04-RESEARCH.md's code example): `entityId` names the assessment line, `field: "infoRequest"`, `after` carries the query text. Minimal, valid against the frozen five-key payload schema; not wired to any real call site until plan 04-04.

## Deviations from Plan

None requiring a rule classification — the items above are interpretation/judgment calls made to satisfy the plan's own machine-verified `<verify>` constraints where its prose (`<action>`) was ambiguous or, in one case, in tension with an already-passing test the same plan requires to survive unchanged. Each is recorded above under Decisions Made rather than as an auto-fix, since none involved a bug, missing critical functionality, or a blocking build failure — only a choice between two readings of the plan text.

## Issues Encountered

- Initial `tsc` pass caught two real type errors introduced by this plan's own code: `AuditEventType` was imported from the wrong module (`@dsar/schemas/audit-event` instead of `@dsar/schemas/primitives`), and `noUncheckedIndexedAccess` correctly flagged three array-destructuring reads (`[reread]`, `[event]`) as possibly-undefined. Both fixed before the first commit; no behavior was affected since these were caught pre-commit.
- `tests/routes/workflow-tracer.test.ts`'s first run failed to resolve `@dsar/engine` from the repo root (not yet a root dependency) — added to root `package.json`, `pnpm install` re-run, resolved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `packages/workflow` and `packages/audit` are real, installed, type-checked, test-runnable workspace packages with exactly one call site converted and proven through the real HTTP route, as this plan's objective required.
- Plan 04-02 has a proven scaffold to extend: `TRANSITIONS` array (add the remaining 8 rows), `evaluate-transition.test.ts` (add per-row test blocks), and the `.dependency-cruiser.cjs`/ESLint purity gates the guard package still needs.
- Plan 04-03 has `PackLifecycleEventWriter` declared and ready to implement, with `packages/audit`'s existing memory-store/deep-copy pattern to follow directly.
- Plan 04-04 has `guard-input.ts`, `audit-trail.ts`, and the `dispositionPayload`/`signOffPayload`/`informationRequestPayload` builders already built and unit-tested, ready to wire into the remaining six status-literal call sites in `data/matters.ts`/`data/assessments.ts` — including `review-session.ts`'s `clearAssessmentOpened`, needed at the STATE-03 recompute call site.
- No blockers. Full suite (`pnpm test`) is 635/635 green — the pre-plan baseline was itself fully green (612/612; no pre-existing failures were observed in this session's baseline run, in contrast to the two historically-known flaky/CRLF failures the plan's precondition anticipated), so this plan's <verify> gate ("failure set byte-identical to the pre-plan baseline") is satisfied at zero failures both before and after.

## Self-Check: PASSED

All 9 claimed key files verified present on disk; all 3 task commit hashes (`e826510`, `524ee32`, `d774acb`) verified present in git history.

---
*Phase: 04-workflow-and-audit-backbone*
*Completed: 2026-09-19*
