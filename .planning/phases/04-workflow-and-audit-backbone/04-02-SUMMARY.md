---
phase: 04-workflow-and-audit-backbone
plan: 02
subsystem: workflow
tags: [state-machine, dependency-cruiser, eslint, guard-table, determinism]

# Dependency graph
requires:
  - phase: 04-workflow-and-audit-backbone (plan 01)
    provides: "packages/workflow's TRANSITIONS array/evaluateTransition scaffold (one authored row, DRAFT --SUBMIT--> COMPUTING), and packages/audit's writer interfaces, both proven end to end through the real submitForAssessment call site"
provides:
  - "packages/workflow/src/guards.ts: seven shared, pure guard predicates (pack-availability, pack-usability, currency-match, at-least-one-line, lawyer-identity, flags-acknowledged, no-lines-pending), each naming its own unmet condition"
  - "packages/workflow/src/transitions.ts: all ten TRANSITIONS entries covering PRD §5's nine guard-table rows (the last naming two origins), in the table's own order"
  - "packages/workflow/src/transitions.test.ts: the GUARD-TABLE completeness test, diffing the whole array against a hand-transcribed copy of PRD §5 in one assertion, plus an origin/non-origin coverage check"
  - ".dependency-cruiser.cjs: no-io-in-workflow and no-infra-in-workflow, each proven by a violating fixture, widening the purity gate from six to eight named rules"
  - "eslint.config.js: a packages/workflow-scoped determinism block (Date/Intl/crypto/Math.random/toLocale*), proven by the WORKFLOW-DETERMINISM fixture suite"
affects: [04-03-pack-lifecycle-writer, 04-04-remaining-call-site-retrofit, 04-05-correction-and-lifecycle-close]

# Actuals (#2632)
actuals:
  tokens: 11859
  tasks: 2
  commits: 2
  plan_head_before: b20e709

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared guard predicates extracted to guards.ts once two-or-more transition rows state the identical PRD §5 precondition (pack-usability, currency-match, at-least-one-line, lawyer-identity), so a shared condition is proven to refuse identically for the same input rather than risk two drifting copies"
    - "checkPackAvailable (existence only) kept deliberately narrower than checkPackUsable (existence + ACTIVE + non-stale) — the recompute and sign-off rows need only a pinned/available pack, not a fully usable one, matching the PRD's own narrower wording for those two rows"
    - "Dependency-cruiser 'to.path' rules for a workspace package with a subpath-export map (\"./*\": \"./src/*.ts\") must match BOTH the raw @dsar/<pkg> specifier and the resolved packages/<pkg>/src path — dependency-cruiser's own module resolution frequently fails to resolve that export shape, in which case its rule matching falls back to the unresolved specifier text, not the resolved file path"

key-files:
  created:
    - packages/workflow/src/guards.ts
    - packages/workflow/src/transitions.test.ts
    - tests/fixtures/workflow-io-violation/impure.ts
    - tests/fixtures/workflow-determinism-violation.fixture.ts
    - tests/toolchain/lint-workflow-determinism.test.ts
  modified:
    - packages/workflow/src/transitions.ts
    - packages/workflow/src/evaluate-transition.test.ts
    - .dependency-cruiser.cjs
    - eslint.config.js
    - package.json
    - tests/toolchain/purity-gate.test.ts

key-decisions:
  - "GuardResult's canonical definition moved from transitions.ts into guards.ts (re-exported from transitions.ts for API stability) — guards.ts needs the type for its own return signatures, and transitions.ts imports guards.ts's predicate functions, so defining GuardResult in transitions.ts would have created an import cycle"
  - "The completeness test's origin/non-origin assertion is written to match the PRD table as actually transcribed, not the plan's own prose: PRD §5 gives CLOSED an outgoing row (the SIGNED_OFF-or-CLOSED -> SUPERSEDED correction row), so CLOSED IS an origin in the array even though the §5 diagram draws CLOSED and SUPERSEDED inside the same terminal box. Only SUPERSEDED has no outgoing row. The plan's task prose says 'the two terminal statuses appear as no row's origin' — this is corrected to the single, PRD-faithful terminal status (SUPERSEDED), per CLAUDE.md's 'PRD is the source of truth' rule. Not a Rule 1-4 deviation (no bug, no missing functionality, no blocker) — a factual correction to an imprecise plan-prose description, applied while writing a test that must match the actual guard table"
  - "Recompute and sign-off rows use checkPackAvailable (existence only), not checkPackUsable (existence+ACTIVE+non-stale) — the plan's own action text for the recompute row says 'a lawyer identity recorded and a pack available' (not 'usable'), and for sign-off says 'a pack pinned', both narrower than the submit/resubmit rows' full pack-usability requirement"
  - "checkAtLeastOneLine's refusal message was generalized from 'before submitting' to a submission-agnostic form so the same shared predicate reads correctly when reused by the resubmit row — no existing test asserted the exact original phrase (only the case-insensitive substring 'expense line'), so this is a safe, in-place wording generalization, not a breaking change"
  - "Both new dependency-cruiser rules match the dependency's specifier text (e.g. '^@dsar/(agent|audit|documents|rulepacks)') in addition to the resolved source path — discovered empirically when the no-infra-in-workflow fixture case (importing @dsar/audit/interface) initially reported zero violations: dependency-cruiser could not resolve the workspace package's subpath-export map inside its own module graph and fell back to matching on the raw specifier, exactly the double-coverage technique the pre-existing no-money-formatting-in-engine rule already used for the identical reason"

patterns-established:
  - "Every transition row's guard composes shared guards.ts predicates in the PRD's own stated evaluation order, returning at the first failure — sign-off's four-condition chain (pending lines, flags acknowledged, lawyer identity, pack pinned) is the clearest instance of this"

requirements-completed: []  # STATE-02 still Pending: the guard table is now complete (all ten rows), but six call sites in apps/web/src/server/data/{matters,assessments}.ts still write MatterStatus literals directly rather than routing through evaluateTransition — that retrofit is plan 04-04's job, per this plan's own <assumptions> and 04-RESEARCH.md Pitfall 2's prescribed one-call-site-at-a-time sequencing

coverage:
  - id: D1
    description: "Every row of PRD §5's transition table exists in the declared TRANSITIONS array, in the table's own order, with a guard predicate that refuses for each precondition that row names"
    requirement: "STATE-02"
    verification:
      - kind: unit
        ref: "packages/workflow/src/transitions.test.ts#GUARD-TABLE: matches PRD §5's guard table transcribed by hand, in the table's own order"
        status: pass
      - kind: unit
        ref: "packages/workflow/src/evaluate-transition.test.ts#GUARD-TABLE: one describe block per row (SUBMIT, COMPUTE_SUCCEEDED, COMPUTE_FAILED, RAISE_QUERY, RESUBMIT, RECOMPUTE, SIGN_OFF, MARK_SENT, SUPERSEDE x2) — 34 tests total, permitted case plus a refusal per named precondition"
        status: pass
    human_judgment: false
  - id: D2
    description: "Asking for a transition the table does not contain is refused by name, not silently permitted"
    verification:
      - kind: unit
        ref: "packages/workflow/src/evaluate-transition.test.ts#GUARD-TABLE: refuses an event with no matching row, naming the origin and the event, and returns no destination"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guard package cannot import a file-system, network, database, framework or sibling-package module, and a violating fixture proves the rule fires rather than merely being declared"
    verification:
      - kind: unit
        ref: "tests/toolchain/purity-gate.test.ts: reports no-io-in-workflow / no-infra-in-workflow over a violating fixture (gate proven to fire); reports zero violations over the real packages/workflow; declares exactly eight forbidden rules, asserted by name"
        status: pass
      - kind: other
        ref: "pnpm run depcruise — exit 0, eight rules active over five targets (engine, schemas, workflow, audit, apps/web)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The guard package cannot read a clock, generate randomness or format by locale — the same determinism discipline the engine already carries"
    verification:
      - kind: unit
        ref: "tests/toolchain/lint-workflow-determinism.test.ts#WORKFLOW-DETERMINISM: reports each of the five determinism bans on its own dedicated fixture line; reports zero problems on negative controls; does not leak onto a packages/audit virtual path"
        status: pass
      - kind: other
        ref: "pnpm run lint — exit 0 over the real tree with the new determinism block in place"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-19
status: complete
---

# Phase 04 Plan 02: Full PRD §5 Guard Table + Purity Gates for packages/workflow Summary

**All ten rows of PRD §5's guard table are now declared, guard-tested and diffable line-for-line against the PRD, and `packages/workflow` cannot acquire a dependency on I/O, the database, the framework, a sibling package, a clock, randomness or locale formatting without two independent CI gates — each proven by a fixture — saying so.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-19T09:55:00Z (approx.)
- **Completed:** 2026-09-19T10:06:00Z
- **Tasks:** 2
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments

- `packages/workflow/src/guards.ts`: seven shared, pure predicates (pack-availability, pack-usability, currency-match, at-least-one-line, lawyer-identity, flags-acknowledged, no-lines-pending), each returning a `GuardResult` naming its own unmet condition — extracted so the submit and resubmit rows' identical PRD preconditions evaluate the same code, proven to refuse byte-identically for the same input
- `packages/workflow/src/transitions.ts`: the `TRANSITIONS` array completed from one row to all ten — nine PRD §5 table rows, the last (`SUPERSEDE`) naming two origins (`SIGNED_OFF`, `CLOSED`) — every row's guard composes `guards.ts` predicates in the PRD's own stated evaluation order
- `packages/workflow/src/transitions.test.ts`: the `GUARD-TABLE` completeness suite — a single whole-array comparison against a hand-transcribed copy of PRD §5, an adjacency check for the two supersede rows, and an origin/non-origin coverage assertion
- `packages/workflow/src/evaluate-transition.test.ts`: extended from 9 to 34 tests — one `describe` block per row, each with its permitted case and a refusal per named precondition, every refusal assertion checking the reason text, not merely the boolean
- `.dependency-cruiser.cjs` + `package.json`: two new purity rules (`no-io-in-workflow`, `no-infra-in-workflow`) anchored at `packages/workflow`, the depcruise script widened to scan `packages/workflow` and `packages/audit`, real run exits 0 over eight rules and five targets
- `eslint.config.js`: a `packages/workflow`-scoped determinism block banning `Date`/`Intl`/`crypto`/`Math.random`/`toLocale*`, with no clock exception (unlike the engine, `GuardInput` carries no `now` at all)
- `tests/fixtures/workflow-io-violation/impure.ts`, `tests/fixtures/workflow-determinism-violation.fixture.ts`, `tests/toolchain/lint-workflow-determinism.test.ts`, and the extended `tests/toolchain/purity-gate.test.ts`: every new gate ships with the fixture that proves it fires, following this codebase's existing "a gate nobody proved fires is indistinguishable from no gate" discipline

## Task Commits

Each task was committed atomically:

1. **Task 1: Every row of the transition table, with the preconditions it actually names** - `c70faf3` (feat)
2. **Task 2: Make the guard package's purity and determinism a CI fact, each with a fixture that proves the gate fires** - `68d7ec7` (feat)

**No separate plan-metadata commit** — `gsd-tools.cjs` is unavailable in this worktree (recurring since 03-03/03-04/03.1/04-01), so STATE.md/ROADMAP.md/REQUIREMENTS.md are updated manually in this same session, following the established sequential-mode precedent (no orchestrator merge step; this plan is `autonomous: true`).

## Files Created/Modified

- `packages/workflow/src/guards.ts` - new: `checkPackAvailable`, `checkPackUsable`, `checkCurrencyMatches`, `checkAtLeastOneLine`, `checkLawyerIdentity`, `checkFlagsAcknowledged`, `checkNoLinesPending`, plus the canonical `GuardResult` type
- `packages/workflow/src/transitions.ts` - `TRANSITIONS` widened from 1 to 10 entries; imports `guards.ts`'s predicates; re-exports `GuardResult` for API stability
- `packages/workflow/src/transitions.test.ts` - new: `GUARD-TABLE` completeness test (3 tests)
- `packages/workflow/src/evaluate-transition.test.ts` - extended: 9 -> 34 tests, one block per row
- `.dependency-cruiser.cjs` - `no-io-in-workflow`, `no-infra-in-workflow` added (6 -> 8 rules)
- `eslint.config.js` - `packages/workflow`-scoped determinism block added
- `package.json` - `depcruise` script target list widened to include `packages/workflow`, `packages/audit`
- `tests/toolchain/purity-gate.test.ts` - 2 new fixture-proof tests, 1 new real-package zero-violations test, rule-count assertion updated (6 -> 8 names)
- `tests/fixtures/workflow-io-violation/impure.ts` - new violating fixture (imports `node:fs` and `@dsar/audit/interface`)
- `tests/fixtures/workflow-determinism-violation.fixture.ts` - new violating fixture (mirrors the engine's determinism fixture)
- `tests/toolchain/lint-workflow-determinism.test.ts` - new: `WORKFLOW-DETERMINISM` suite (3 tests)

## Decisions Made

- `GuardResult`'s canonical definition lives in `guards.ts`, not `transitions.ts` — `transitions.ts` importing `guards.ts`'s predicate functions while `guards.ts` needed the `GuardResult` type would have created a circular import if the type stayed in `transitions.ts`. `transitions.ts` re-exports the type so no import site elsewhere needed to change.
- The completeness test's origin/non-origin assertion follows the PRD table as actually transcribed rather than the plan's own summary prose. PRD §5 gives `CLOSED` its own outgoing row (`SIGNED_OFF` or `CLOSED` -> `SUPERSEDED`), so `CLOSED` is genuinely an origin in the array — only `SUPERSEDED` has no outgoing row. The plan's task `<behavior>` line says "the two terminal statuses appear as no row's origin," which does not hold once the table is actually implemented (the diagram's terminal box groups `CLOSED`/`SUPERSEDED` visually, but the guard table itself gives `CLOSED` an edge). Per CLAUDE.md ("the PRD wins"), the test asserts the single, correct terminal status and documents why in its own comment.
- `checkPackAvailable` (pack exists) is kept distinct from `checkPackUsable` (pack exists, is `ACTIVE`, and is not `STALE`) — the recompute row's guard ("a lawyer identity recorded and a pack available") and the sign-off row's fourth condition ("a pack pinned") are both narrower than submit/resubmit's full usability requirement, matching the plan's own action text precisely.
- `checkAtLeastOneLine`'s message was generalized from "...required before submitting" to "...required" so the identical shared predicate reads correctly when the resubmit row reuses it — no existing assertion depended on the exact original wording.
- Both new dependency-cruiser rules' `to.path` arrays match the dependency's raw `@dsar/<pkg>` specifier text in addition to the resolved `packages/<pkg>/src` path. This was discovered empirically: the first `no-infra-in-workflow` fixture run (importing `@dsar/audit/interface`) reported zero violations because dependency-cruiser could not resolve that workspace package's subpath-export map (`"./*": "./src/*.ts"`) inside its own module graph and fell back to matching against the unresolved specifier text — the same double-coverage technique the pre-existing `no-money-formatting-in-engine` rule already uses for the identical reason (see that rule's own comment in `.dependency-cruiser.cjs`).

## Deviations from Plan

None requiring a Rule 1-4 classification. The items above (GuardResult's home, the origin/non-origin test correction, the two narrower pack predicates, the message generalization, and the specifier-matching fix) are implementation judgment calls made either to keep the code non-circular, to make a test factually correct against the real PRD table, or to make a machine-verified `<verify>`/acceptance-criteria requirement actually pass — none involved a bug in delivered behavior, missing critical functionality, or an unresolvable blocker; all are documented above under Decisions Made.

## Issues Encountered

- The `no-infra-in-workflow` fixture case initially failed (`exitCode` was `0` when it should have been non-zero) because dependency-cruiser could not resolve `@dsar/audit/interface` through the audit package's subpath-export map and treated the dependency as unresolved, which does not match a resolved-path-only pattern. Fixed by adding a specifier-text pattern (`^@dsar/(agent|audit|documents|rulepacks)`) alongside the resolved-path pattern, mirroring the existing `no-money-formatting-in-engine` rule's own double-coverage comment. Caught and fixed before commit; no behavior was affected since this was a test-writing issue, not a defect in the real rule's intent.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `packages/workflow`'s guard table is now complete and CI-enforced for purity and determinism — plan 04-04 (the remaining six status-literal call-site retrofit) has every guard row it needs, plus `guards.ts`'s shared predicates to reuse rather than re-derive, for `resubmitAfterInfoRequest`, `dispositionLine`/`bulkAcceptLines` (audit-only, no transition per 04-RESEARCH.md Assumption A4), `signOff`, and `askHr`.
- `packages/audit`'s `PackLifecycleEventWriter` remains declared-not-implemented (04-03's job); this plan's dependency-cruiser rule explicitly forbids `packages/workflow` from ever depending on it, so no accidental coupling is possible once 04-03 lands.
- No blockers. Full suite (`pnpm test`) is 666/666 green (up from the 660/660 recorded after Task 1, and the 635/635 baseline recorded at the start of this plan) — `pnpm run depcruise` exits 0 (eight rules, five targets), `pnpm run lint` and `pnpm run typecheck` both exit 0.
- `gsd-tools.cjs` remains unavailable in this worktree during 04-02 execution (same recurring gap as 03-03/03-04/03.1/04-01) — STATE.md/ROADMAP.md updated manually again this plan.

## Self-Check: PASSED

All 5 newly-created key files verified present on disk; both task commit hashes (`c70faf3`, `68d7ec7`) verified present in git history.

---
*Phase: 04-workflow-and-audit-backbone*
*Completed: 2026-09-19*
