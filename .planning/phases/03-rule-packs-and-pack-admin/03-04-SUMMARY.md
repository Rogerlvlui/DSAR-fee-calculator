---
phase: 03-rule-packs-and-pack-admin
plan: 04
subsystem: rulepacks
tags: [calendar-math, staleness, versioning, vitest, tdd]

requires:
  - phase: 03-rule-packs-and-pack-admin (plan 03-01)
    provides: "packages/rulepacks package, LoadableRulePackSchema, loadRulePackFile/loadAllRulePacks, RULEPACKS_ROOT"
provides:
  - "deriveEffectiveStatus/daysUntilReviewDue/staleReason (packages/rulepacks/src/stale.ts) — currency of a pack is a derived answer, never a trusted stored literal"
  - "resolveRulePack(packId, version, root) (packages/rulepacks/src/loader.ts) — the loader's counterpart to Assessment.rulePackVersion, a deterministic pinned-version lookup"
  - "packages/engine's calendar-math reachable by package specifier (\"./calendar-math\" export), so any later package can reuse daysUntil without a relative reach into packages/engine/src"
affects: [03.2-database-boundary-and-audit-immutability, 03-05, 05, 06]

actuals:
  tokens: 5313
  tasks: 2
  commits: 2
  plan_head_before: 6f2a050eae29967a854eee7c9bc7a78bb7e0a299

tech-stack:
  added: []
  patterns:
    - "New dependency edge @dsar/rulepacks -> @dsar/engine, added via an additive exports map on packages/engine/package.json (\".\" and \"./calendar-math\") alongside the existing main field — nothing that resolved through main before this plan changes"
    - "Pack test inputs built by spreading a committed stub pack (VN-PDPL) and overriding only the fields under test, rather than a hand-authored parallel fixture — same discipline loader.test.ts's PACK-10 test already established"
    - "resolveRulePack builds its own path from root/packId/version rather than delegating to loadAllRulePacks — deliberate: exhaustiveness (load everything) and pinned lookup (load exactly one, from either the real tree or an isolated fixture root) are different operations with different failure modes"

key-files:
  created:
    - packages/rulepacks/src/stale.ts
    - packages/rulepacks/src/stale.test.ts
    - packages/rulepacks/src/versions.test.ts
    - packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.01.1.json
    - packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.06.1.json
    - packages/rulepacks/src/__fixtures__/versions-single/ACME-FIXTURE/2026.01.1.json
  modified:
    - packages/engine/package.json
    - packages/rulepacks/package.json
    - packages/rulepacks/src/loader.ts
    - pnpm-lock.yaml

key-decisions:
  - "ACME-FIXTURE test packs authored as minimal DRAFT packs (one categoryRule, all-null StubConstraints) rather than 21-category ACTIVE packs — resolveRulePack only exercises loadRulePackFile's LoadableRulePackSchema parse boundary, never assertActiveReady, so a smaller fixture proves the same property (pinned lookup, cross-root content stability) without unrelated ACTIVE-readiness ceremony"
  - "RulePackNotFoundError and RulePackVersionMismatchError authored as plain Error subclasses (name + message only) rather than the RulePackValidationFailure code/detail convention — loader.ts's existing style has no structured-error precedent (validate.ts's convention belongs to the validation layer, one layer up), and stub-category-rules.ts's UnknownPackJurisdictionError/NotAStubPackError pair is the loader-adjacent precedent this plan follows instead"
  - "RulePackVersionMismatchError is implemented (guards a file whose own packId/version disagrees with its directory/filename, per the plan's action text and threat T-03-13) but not exercised by a dedicated test — none of Task 2's six specified behaviors calls for it, and authoring a seventh fixture solely to cover it would have gone beyond the plan's declared files_modified list"

patterns-established:
  - "A package's calendar/date arithmetic is exposed for reuse via an additive package.json exports subpath (packages/engine's \"./calendar-math\"), not via a relative cross-package import into another package's src/ — keeps the reused surface an intentional, versioned contract rather than an implementation detail another package happens to reach into"

requirements-completed: [PACK-04, PACK-05]

coverage:
  - id: D1
    description: "PACK-04: a pack's usability is derived from reviewDueOn against an injected now, never trusted from the stored status literal; the 'past, not on' boundary matches packages/engine/src/preconditions.ts's own check exactly; derivation only ever downgrades (DRAFT/WITHDRAWN/already-STALE all pass through unchanged); staleReason names both dates and is banned-word-free"
    requirement: "PACK-04"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: an ACTIVE pack whose reviewDueOn is one day before now derives STALE"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: an ACTIVE pack whose reviewDueOn equals now's calendar date derives ACTIVE — past, not on"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: an ACTIVE pack whose reviewDueOn is one day after now derives ACTIVE"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: a DRAFT pack past its reviewDueOn derives DRAFT — derivation never overrides a stored non-ACTIVE status"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: a WITHDRAWN pack past its reviewDueOn derives WITHDRAWN — derivation never overrides a stored non-ACTIVE status"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: a pack whose stored status is STALE with a future reviewDueOn derives STALE — derivation never makes a pack look fresher than its stored status claims"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: staleReason returns null for a non-stale pack"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: staleReason for a stale pack returns a string containing both the reviewDueOn value and the now value"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: findBannedWord(staleReason(stalePack, now)) returns null"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/stale.test.ts#PACK-04: daysUntilReviewDue returns a positive/zero/negative number for a future/today/past reviewDueOn (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PACK-05 (repository half of AC-40): resolving a pinned (packId, version) returns that exact version's content; a newer version file landing in the same pack directory leaves the older version's resolved content byte-identical; loadAllRulePacks returns both versions without collision; unknown version/packId both throw naming what was requested; resolution is idempotent"
    requirement: "PACK-05"
    verification:
      - kind: unit
        ref: "packages/rulepacks/src/versions.test.ts#PACK-05: resolveRulePack('ACME-FIXTURE', '2026.01.1', twoVersionRoot) returns the pack whose version is 2026.01.1, not the newest one in the directory"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/versions.test.ts#PACK-05: the pack resolved for 2026.01.1 from the two-version root deep-equals the pack resolved for the same id and version from the single-version root"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/versions.test.ts#PACK-05: loadAllRulePacks(twoVersionRoot) returns two entries for the same packId, and neither overwrites the other"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/versions.test.ts#PACK-05: resolving an unknown version throws an error naming both the packId and the requested version"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/versions.test.ts#PACK-05: resolving an unknown packId throws an error naming the packId"
        status: pass
      - kind: unit
        ref: "packages/rulepacks/src/versions.test.ts#PACK-05: resolveRulePack called twice for the same id and version returns deep-equal values"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-17
status: complete
---

# Phase 3 Plan 4: PACK-04 staleness derivation and PACK-05 version pinning Summary

**`deriveEffectiveStatus`/`staleReason` turn "is this pack usable?" into a computed fact reusing the engine's own proven calendar arithmetic, and `resolveRulePack` turns "which version was this pinned to?" into a deterministic lookup that a newer sibling version cannot disturb**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-17T21:39:00Z
- **Completed:** 2026-09-17T22:14:00Z
- **Tasks:** 2 completed
- **Files modified:** 10 (4 modified, 6 created)

## Accomplishments
- `packages/engine/package.json` gained an additive `exports` map (`"."` and `"./calendar-math"`) alongside its existing `main`, making the engine's calendar arithmetic reachable by package specifier without disturbing anything that already resolved through `main`
- `packages/rulepacks` now depends on `@dsar/engine` (`workspace:*`) — the only new dependency direction is rulepacks → engine, which `.dependency-cruiser.cjs`'s engine-purity rules (all anchored `from: ^packages/engine`) cannot forbid
- `stale.ts` — `deriveEffectiveStatus`, `daysUntilReviewDue`, `staleReason`, all pure functions taking an injected `now`, importing `daysUntil` from `@dsar/engine/calendar-math` rather than reimplementing day-counting arithmetic. `deriveEffectiveStatus` mirrors `packages/engine/src/preconditions.ts`'s exact "past, not on" boundary (strict `< 0`) and only ever downgrades a pack's reported status, never upgrades one
- `resolveRulePack(packId, version, root)` on `loader.ts` — builds the file path deterministically, throws `RulePackNotFoundError` (naming both packId and version) instead of a raw `ENOENT` when the file is absent, and throws `RulePackVersionMismatchError` if a resolved file's own `packId`/`version` fields disagree with the request (T-03-13: a file moved or renamed into the wrong directory fails loudly)
- Two `ACME-FIXTURE` pack versions proving PACK-05's actual AC-40 property: `versions/ACME-FIXTURE/{2026.01.1,2026.06.1}.json` differ in `categoryRules[0].treatment` (FLAG vs ALLOW) so a wrong resolution is visible, and `versions-single/ACME-FIXTURE/2026.01.1.json` is a byte-identical copy of the older version alone in its own root — the pair that lets the test compare "before the newer version existed" against "after"
- `pnpm run pack:validate` still exits 0 over the real tree — none of the new fixture roots (`__fixtures__/versions`, `__fixtures__/versions-single`) are globbed by `loadAllRulePacks()`'s directory scan

## Task Commits

Each task was committed atomically (implementation and tests together — no separate RED/GREEN pair; see Issues Encountered):

1. **Task 1: PACK-04 — staleness derived from an injected now, on the engine's own calendar** - `3a7c634` (feat)
2. **Task 2: PACK-05 — a pinned version resolves to the same content forever** - `fa085d8` (feat)

**Plan metadata:** (final commit, recorded after this SUMMARY)

## Files Created/Modified
- `packages/engine/package.json` - adds an `exports` map (`"."`, `"./calendar-math"`) alongside the existing `main`
- `packages/rulepacks/package.json` - adds `@dsar/engine: workspace:*` to `dependencies`
- `packages/rulepacks/src/stale.ts` - new file: `deriveEffectiveStatus`, `daysUntilReviewDue`, `staleReason`
- `packages/rulepacks/src/stale.test.ts` - new file: 12 tests, all named with `PACK-04`
- `packages/rulepacks/src/loader.ts` - adds `resolveRulePack`, `RulePackNotFoundError`, `RulePackVersionMismatchError`
- `packages/rulepacks/src/versions.test.ts` - new file: 6 tests, all named with `PACK-05`
- `packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.01.1.json` - fictional two-version test pack, older version (FLAG)
- `packages/rulepacks/src/__fixtures__/versions/ACME-FIXTURE/2026.06.1.json` - same pack, newer version (ALLOW) — the visible-if-wrong difference
- `packages/rulepacks/src/__fixtures__/versions-single/ACME-FIXTURE/2026.01.1.json` - byte-identical copy of the older version, alone in its own root
- `pnpm-lock.yaml` - relinked after the new internal `workspace:*` dependency

## Decisions Made
- ACME-FIXTURE test packs are minimal DRAFT packs (one `categoryRule`, all-`null` `StubConstraints`) rather than full 21-category ACTIVE packs — `resolveRulePack` only exercises `loadRulePackFile`'s `LoadableRulePackSchema` parse boundary, never `assertActiveReady`, so the smaller fixture proves the same pinned-lookup/cross-root-stability property without unrelated ACTIVE-readiness ceremony.
- `RulePackNotFoundError`/`RulePackVersionMismatchError` are plain `Error` subclasses (name + message, no `code`/`detail` fields) rather than following `validate.ts`'s `RulePackValidationFailure` structured-error convention — `loader.ts` had no structured-error precedent of its own before this plan, and `stub-category-rules.ts`'s `UnknownPackJurisdictionError`/`NotAStubPackError` pair (same package, adjacent concern) is the closer precedent.
- `RulePackVersionMismatchError` is implemented per the plan's action text and threat T-03-13, but not exercised by a dedicated test in this plan — none of Task 2's six specified `<behavior>` items calls for it, and a seventh fixture solely to cover it would have gone beyond the plan's declared `files_modified` list. Flagged here rather than silently added or silently skipped.

## Deviations from Plan

None — no bugs, missing critical functionality, or blocking issues were encountered. Both tasks were implementable exactly as the plan's `<action>` text specified, including the exports-map addition, the dependency direction, and the fixture-pair structure.

## Issues Encountered

**No `gsd-tools.cjs` available in this worktree — RED/GREEN TDD commit pairs not produced (same gap 03-03 recorded).** Both tasks are marked `tdd="true"`. As in 03-03, each task's production code and tests were written and verified together: every new test was run against its implementation and confirmed to fail for the intended reason (via a throwaway script asserting the specific expected value/error before finalizing) rather than skipping straight to a green suite. This preserves the "prove the behavior, don't just assert a passing suite" discipline without a literal RED-commit/GREEN-commit pair.

**Pre-existing, out-of-scope test failure (not fixed, already logged in 03-01/03-02/03-03):** `pnpm test` still reports one failing test — `packages/schemas/src/json-schema.test.ts`'s CRLF/LF drift check (WINDOWS.md ledger entry #1). Confirmed unrelated: this plan touches only `packages/engine/package.json`, `packages/rulepacks/package.json`, `packages/rulepacks/src/{stale.ts,stale.test.ts,loader.ts,versions.test.ts}`, three new fixtures under `src/__fixtures__/`, and `pnpm-lock.yaml` — never `packages/schemas/src/json-schema.ts` or its committed schema artifacts. 441 of 442 tests pass across the full monorepo suite (18 of them new — 12 `PACK-04` + 6 `PACK-05`); `pnpm run typecheck`, `pnpm run lint`, `pnpm run depcruise`, and `pnpm run pack:validate` all exit 0.

## Known Stubs

None introduced by this plan. The `ACME-FIXTURE` packs are genuinely invented placeholder content by design (a *shape* fixture proving lookup/stability behavior, documented in `versions.test.ts`'s header comment as fictional — never to be treated as a real jurisdiction) — this is the specified test-fixture behavior, not an oversight.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registers: T-03-12 (stored `status` tampering, mitigated by `deriveEffectiveStatus` recomputing from `reviewDueOn`), T-03-13 (pinned-version tampering, mitigated by `resolveRulePack`'s packId/version assertion), T-03-14 (`staleReason` text, mitigated by the same `findBannedWord` matcher `validate.ts` uses), and T-03-15 (the new `rulepacks` → `engine` edge, mitigated by `pnpm run depcruise` staying a task acceptance criterion) are all mitigated as described in the plan; T-03-SC (no new external package installed) is accepted as recorded.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `deriveEffectiveStatus`, `daysUntilReviewDue`, and `staleReason` are ready for the AC-39 HTTP half (a 409 response and the in-flight-review full-width notice, per D-20 — neither built here) and for Phase 5's 30-day advance warning, which can now read `daysUntilReviewDue` from one place instead of re-deriving it.
- `resolveRulePack` is ready for Phase 3.1/3.2's engine boundary, where `Assessment.rulePackVersion` becomes the pinned value handed to it.
- **PACK-05 is discharged here only at the repository layer** (per 03-VALIDATION.md's binding scope and the plan's own `<assumptions>`). The assessment-side half of AC-40 — that an existing assessment's verdicts and amounts are untouched by a new activation — needs persisted assessments and belongs to Phase 3.2.
- The pre-existing `json-schema.test.ts` CRLF/LF drift failure (see Issues Encountered) still blocks a clean `pnpm test` exit; unrelated to this plan and unchanged from 03-01/03-02/03-03's finding.
- No `gsd-tools.cjs` was found in this worktree; STATE.md/ROADMAP.md/REQUIREMENTS.md updates were performed manually here, same as 03-03.

---
*Phase: 03-rule-packs-and-pack-admin*
*Completed: 2026-09-17*

## Self-Check: PASSED

All 10 created/modified files verified present on disk; both task commit hashes (`3a7c634`, `fa085d8`) verified present in `git log --oneline --all`.
