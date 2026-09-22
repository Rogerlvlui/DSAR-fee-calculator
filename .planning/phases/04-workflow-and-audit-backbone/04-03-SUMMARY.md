---
phase: 04-workflow-and-audit-backbone
plan: 03
subsystem: workflow-audit
tags: [zod, vitest, audit-log, in-memory-repository, guard-input, rbac]

# Dependency graph
requires:
  - phase: 04-01
    provides: "the PackLifecycleEventWriter interface (declared, not implemented), the matter-scoped AuditEventWriter/store pattern this plan's writer mirrors exactly, and the payload-builder convention over the single frozen AuditPayloadSchema"
provides:
  - "packages/audit: PackLifecycleEventWriter's in-memory implementation (append/listByPack/exportAll), the pack-activation and pack-edited payload builders, and the pack-lifecycle collection + monotonic counter added to the shared globalThis-anchored store"
  - "apps/web/src/server/data/auth.ts: the DPO_ADMIN demo identity, resolved from the same dsar_demo_role cookie path as the other two, deliberately absent from the role switcher"
  - "apps/web/src/server/data/audit.ts: exportAuditLog(actor) — the DPO-gated function returning both the matter-scoped and pack-lifecycle exports together"
affects: [04-04-remaining-call-site-retrofit, 04-05-correction-and-lifecycle-close]

# Actuals (#2632)
actuals:
  tokens: 6765
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PackLifecycleEventWriter mirrors memory/audit-event-writer.ts's monotonic-zero-padded-id / deep-copy / frozen-schema-parse discipline exactly, over its own Map and counter inside the same globalThis-anchored store object"
    - "The pack-lifecycle writer validates only the payload against the already-frozen AuditPayloadSchema — there is no second, stream-private schema for the full event shape, since interface.ts never declared one"
    - "A demo role is added to DEMO_USERS without automatically appearing in the UI role switcher — apps/web/app/layout.tsx's ACTOR_OPTIONS is a hardcoded literal list, not derived from the record's keys"

key-files:
  created:
    - packages/audit/src/memory/pack-lifecycle-event-writer.ts
    - packages/audit/src/memory/pack-lifecycle-event-writer.test.ts
    - apps/web/src/server/data/audit.ts
    - tests/routes/audit-export.test.ts
  modified:
    - packages/audit/src/memory/store.ts
    - packages/audit/src/payload-builders.ts
    - apps/web/src/server/data/auth.ts

key-decisions:
  - "packActivatedPayload(before, after) carries the pack's own lifecycle status as field:'status'; packEditedPayload(field) names only the edited field with no before/after pair — both minimal shapes valid against the frozen five-key AuditPayloadSchema, matching the plan's own two-sentence design brief rather than inventing additional structure"
  - "The undeclared-payload-key refusal test and the deep-copy tests assert against listByPack(packId, version) scoped to a test-unique pack id, not literally exportAll() — the pack-lifecycle store is a globalThis-anchored singleton shared across every test in the file, so a literal exportAll() would already carry unrelated earlier tests' events (same reasoning 04-01's AUDIT-WRITER tests already established for the matter-scoped stream)"
  - "BOUND-05 and AUDIT-04 marked Complete in REQUIREMENTS.md; AUDIT-01 and AUDIT-03 stay Pending — this plan's pack-activation clause is discharged only structurally (writer proven, no admin screen exists yet to call it from, PACK-07/Phase 3.2), and the transition/disposition/sign-off call sites AUDIT-01 mostly depends on are 04-04's retrofit, not this plan's"
  - "DPO_ADMIN's fresh ULID (01M2VQ03WC9DDCY458Y2YH1HNH) generated via the same ulid package apps/web/src/server/ids.ts already depends on, verified against UlidSchema before being committed, distinct from both existing demo identities"

patterns-established: []

requirements-completed: ["AUDIT-04", "BOUND-05"]  # AUDIT-01 stays Pending — see key-decisions

coverage:
  - id: D1
    description: "A pack-activation event can be appended, listed by its pack and version, and exported, on a stream of its own that carries no matter identifier at all"
    requirement: "AUDIT-01"
    verification:
      - kind: unit
        ref: "packages/audit/src/memory/pack-lifecycle-event-writer.test.ts#PACK-LIFECYCLE: appending a pack-activation event returns it with a monotonic identifier and stores it"
        status: pass
      - kind: unit
        ref: "packages/audit/src/memory/pack-lifecycle-event-writer.test.ts#PACK-LIFECYCLE: listing by pack identifier and version returns only that pack version's events, in written order, and not another version's"
        status: pass
      - kind: unit
        ref: "packages/audit/src/memory/pack-lifecycle-event-writer.test.ts#PACK-LIFECYCLE: the stored event carries no matter identifier field at all"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pack-lifecycle stream refuses an undeclared payload key on the same frozen schema the matter-scoped stream uses, and hands out only copies"
    requirement: "BOUND-05"
    verification:
      - kind: unit
        ref: "packages/audit/src/memory/pack-lifecycle-event-writer.test.ts#PACK-LIFECYCLE: appending an event whose payload carries a key outside the declared set is refused and nothing is stored"
        status: pass
      - kind: unit
        ref: "packages/audit/src/memory/pack-lifecycle-event-writer.test.ts#PACK-LIFECYCLE: a caller mutating an event returned by listByPack leaves the stored record unchanged"
        status: pass
      - kind: unit
        ref: "packages/audit/src/memory/pack-lifecycle-event-writer.test.ts#PACK-LIFECYCLE: a caller mutating an event returned by exportAll leaves the stored record unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "A data-protection officer identity exists, resolves from the same cookie path every other demo identity resolves from, and is the only role that can export the audit log"
    requirement: "AUDIT-04"
    verification:
      - kind: unit
        ref: "tests/routes/audit-export.test.ts#AUDIT-EXPORT: a cookie naming the officer role resolves to the officer identity, with the officer role attached"
        status: pass
      - kind: unit
        ref: "tests/routes/audit-export.test.ts#AUDIT-EXPORT: the export called as a preparer is refused, and the refusal names the required role"
        status: pass
      - kind: unit
        ref: "tests/routes/audit-export.test.ts#AUDIT-EXPORT: the export called as a reviewer is refused"
        status: pass
    human_judgment: false
  - id: D4
    description: "The export returns every matter-scoped event and every pack-lifecycle event in written order; a preparer or a reviewer asking for it is refused"
    requirement: "AUDIT-04"
    verification:
      - kind: integration
        ref: "tests/routes/audit-export.test.ts#AUDIT-EXPORT: the export, called with an actor resolved from an officer cookie, returns every matter-scoped event and every pack-lifecycle event written so far"
        status: pass
      - kind: unit
        ref: "tests/routes/audit-export.test.ts#AUDIT-EXPORT: the export returns events in written order across more than one matter, so ordering is proven to be global rather than per-matter"
        status: pass
      - kind: unit
        ref: "tests/routes/audit-export.test.ts#AUDIT-EXPORT: the export returns deep copies — mutating the result and re-exporting shows the store unchanged"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-19
status: complete
---

# Phase 04 Plan 03: Pack-Lifecycle Event Stream + DPO Audit Export Summary

**A pack-activation event now has its own append-only, matter-free stream (D-21) — proven by 9 direct unit tests with no admin screen to drive it from — and a new `DPO_ADMIN` demo identity can export both that stream and the matter-scoped one together through one role-gated function, proven by 8 more tests that resolve the officer through the real cookie path rather than constructing one by hand.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-19T09:55:00Z (approx.)
- **Completed:** 2026-09-19T10:30:00Z (approx.)
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `packages/audit/src/memory/pack-lifecycle-event-writer.ts`: the in-memory `PackLifecycleEventWriter` (D-21's separate stream, declared by 04-01, implemented here) — monotonic zero-padded ids, deep-copy isolation on both `listByPack` and `exportAll`, and every append validated against the already-frozen `AuditPayloadSchema` with no second schema authored
- `packages/audit/src/memory/store.ts`: the pack-lifecycle collection and its own monotonic counter added inside the same `globalThis`-anchored object as the matter-scoped events, so a refresh cannot reset one stream while leaving the other's events in place
- `packages/audit/src/payload-builders.ts`: `packActivatedPayload(before, after)` and `packEditedPayload(field)`, both returning the frozen `AuditPayload` type
- 9 `PACK-LIFECYCLE` tests, the most important being the separation test — it writes into both the matter-scoped and pack-lifecycle streams in the same test and asserts neither export leaks the other's events, and that the stored pack-lifecycle event carries no `matterId` property at all
- `apps/web/src/server/data/auth.ts`: a third demo identity, `DPO_ADMIN`, with a freshly generated and `UlidSchema`-verified id distinct from the existing two, resolved from the same `dsar_demo_role` cookie the other two already use; the unrecognised-cookie fallback still lands on `HR_PREPARER`, never escalating
- `apps/web/src/server/data/audit.ts`: `exportAuditLog(actor)` — `requireRole(actor, "DPO_ADMIN")` as its literal first statement, returning the matter-scoped export and the pack-lifecycle export together in one call
- 8 `AUDIT-EXPORT` tests, resolving the officer actor through the real `resolveActorFromCookieHeader` function (never constructed inline), seeding the matter-scoped half by driving the real create/add-line/submit routes, and proving both refusal paths name the required role, global (not per-matter) write-order, and deep-copy isolation
- `DPO_ADMIN` deliberately NOT added to `apps/web/app/layout.tsx`'s role switcher — no officer-facing screen exists this phase, and a switcher entry leading only to refusals would be a worse demo than none
- Full suite (`pnpm test`) verified 683/683 green — 666 pre-existing plus this plan's 17 new tests; `pnpm run typecheck` and `pnpm run lint` both exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: The pack-lifecycle stream — a second append-only record, keyed to a pack rather than a matter** - `6ae08b4` (feat)
2. **Task 2: The data-protection officer identity, and the export only that role can perform** - `b899396` (feat)

_No separate plan-metadata commit — `commit_docs: true` but this worktree has no `gsd-tools.cjs` available (recurring since 03-03/03-04/03.1/04-01/04-02), so STATE.md/ROADMAP.md/REQUIREMENTS.md are updated manually in this same session and folded into this SUMMARY's own commit, per the established sequential-mode precedent._

## Files Created/Modified

- `packages/audit/src/memory/pack-lifecycle-event-writer.ts` - the in-memory `PackLifecycleEventWriter`, mirroring `memory/audit-event-writer.ts`'s discipline exactly
- `packages/audit/src/memory/pack-lifecycle-event-writer.test.ts` - 9 `PACK-LIFECYCLE` tests
- `packages/audit/src/memory/store.ts` - `packLifecycleEvents` Map and `nextPackLifecycleId` counter added to the shared `AuditStore`
- `packages/audit/src/payload-builders.ts` - `packActivatedPayload`, `packEditedPayload` added
- `apps/web/src/server/data/auth.ts` - `DPO_ADMIN` demo identity added, `DEMO_USERS`' key union widened, cookie-resolution branch added
- `apps/web/src/server/data/audit.ts` - new module, `exportAuditLog(actor)`
- `tests/routes/audit-export.test.ts` - 8 `AUDIT-EXPORT` tests

## Decisions Made

- `packActivatedPayload`/`packEditedPayload` kept deliberately minimal — a status before/after pair for activation, a bare field name for an edit — matching the plan's own two-sentence design brief rather than inventing additional payload structure the frozen five-key schema doesn't need.
- The undeclared-key and deep-copy tests assert against `listByPack(packId, version)` scoped to a test-unique pack identifier rather than a literal `exportAll()` call, for the identical reason 04-01's `AUDIT-WRITER` tests already established: the store is a shared `globalThis` singleton across every test in the file, so `exportAll()` accumulates unrelated events from earlier tests in the same run.
- `BOUND-05` and `AUDIT-04` marked Complete in `REQUIREMENTS.md`. `AUDIT-01` stays Pending: its pack-activation clause is now discharged structurally (the writer exists and is proven, with the module header naming the real admin write path as PACK-07/Phase 3.2's job), but the requirement's transition/disposition/sign-off clauses depend on 04-04's retrofit of the remaining six status-literal call sites, which has not happened yet.
- `DPO_ADMIN`'s identifier (`01M2VQ03WC9DDCY458Y2YH1HNH`) was freshly generated via the same `ulid` package `apps/web/src/server/ids.ts` already depends on, and verified against `UlidSchema` before being committed — distinct from both `HR_PREPARER_USER` and `LEGAL_REVIEWER_USER`'s ids.

## Deviations from Plan

None requiring a rule classification — plan executed as written. `packActivatedPayload`/`packEditedPayload`'s exact shape was a judgment call within the plan's own two-sentence design brief (documented above under Decisions Made), not a bug fix, missing-functionality addition, or blocking-issue fix.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `PackLifecycleEventWriter` is a real, tested, in-memory writer with an established call convention (`append`/`listByPack`/`exportAll`) ready for Phase 3.2's PACK-07 to wire a real `/admin/rulepacks` activation action into, once that screen exists.
- `exportAuditLog` is a plain, unit-tested data-layer function; a route and a DPO-facing screen are later-phase work, not a gap in this plan (per the plan's own recorded assumptions).
- Plan 04-04 has `evaluateTransition`, `guard-input.ts`, `audit-trail.ts`, and the `dispositionPayload`/`signOffPayload`/`informationRequestPayload` builders (already built in 04-01) ready to wire into the six remaining status-literal call sites in `data/matters.ts`/`data/assessments.ts` — this plan touched neither file.
- No blockers. Full suite (`pnpm test`) is 683/683 green.

## Self-Check: PASSED

All 7 claimed key files verified present on disk; both task commit hashes (`6ae08b4`, `b899396`) verified present in git history.

---
*Phase: 04-workflow-and-audit-backbone*
*Completed: 2026-09-19*
